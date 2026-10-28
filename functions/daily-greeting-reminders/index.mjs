import { attachDatabasePool } from '@neon/functions';
import { parseTriggerDelivery } from '@neon/functions/triggers';
import pg from 'pg';
import {
  fetchIndiaPublicHolidays,
  globalObservancesForYear,
  isPostWorthyEvent,
} from '../../src/lib/calendarSources.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
attachDatabasePool(pool);

const localDateInIndia = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const saveObservances = async (date) => {
  const year = Number(date.slice(0, 4));
  const owners = await pool.query(
    'SELECT DISTINCT owner_id FROM public.companies WHERE is_demo = false',
  );
  if (!owners.rowCount) return { inserted: 0, failedYears: [] };

  let incoming = [
    ...globalObservancesForYear(year),
    ...globalObservancesForYear(year + 1),
  ];
  const holidayResults = await Promise.allSettled([
    fetchIndiaPublicHolidays(year, AbortSignal.timeout(12000)),
    fetchIndiaPublicHolidays(year + 1, AbortSignal.timeout(12000)),
  ]);
  const failedYears = [];
  for (const [index, result] of holidayResults.entries()) {
    if (result.status === 'fulfilled') incoming.push(...result.value);
    else {
      failedYears.push(year + index);
      console.error('Nager.Date refresh failed; saved observances remain available:', result.reason?.message || result.reason);
    }
  }

  let inserted = 0;
  for (const owner of owners.rows) {
    for (const event of incoming) {
      if (!isPostWorthyEvent(event)) continue;
      const result = await pool.query(
        `INSERT INTO public.calendar_events
           (owner_id, title, date, category, region, description, source, seed_key, status)
         SELECT $1, $2, $3::date, $4, $5, $6, $7, $8, 'Planned'
         WHERE NOT EXISTS (
           SELECT 1
           FROM public.calendar_events saved
           WHERE saved.owner_id = $1
             AND saved.date = $3::date
             AND lower(btrim(saved.title)) = lower(btrim($2))
         )
         ON CONFLICT (owner_id, seed_key) DO NOTHING`,
        [owner.owner_id, event.title, event.date, event.category, event.region, event.description, event.source, event.seed_key],
      );
      inserted += result.rowCount;
    }
  }
  return { inserted, failedYears };
};

const createGreetingTasks = async (date) => {
  const result = await pool.query(
    `INSERT INTO public.tasks
       (owner_id, company_id, calendar_event_id, title, description, category, priority, status, due_date, notes, seed_key)
     SELECT
       event.owner_id,
       company.id,
       event.id,
       'Greeting post: ' || event.title,
       'Create a greeting post for ' || event.title || ' by ' || to_char(event.date, 'FMDD Mon YYYY') || '.',
       'Social Media',
       'Medium',
       'To Do',
       event.date,
       'Generated from calendar event ' || event.id::text || '. Link the post and mark this task done when ready.',
       'calendar-event-post:' || COALESCE(event.seed_key, event.id::text) || ':' || company.id::text
     FROM public.calendar_events event
     JOIN public.companies company
       ON company.owner_id = event.owner_id
      AND (event.company_id IS NULL OR company.id = event.company_id)
     WHERE event.is_demo = false
       AND company.is_demo = false
       AND event.status <> 'Cancelled'
       AND event.category IN ('Festival', 'Indian national day', 'Global observance')
       AND event.date BETWEEN $1::date AND ($1::date + 30)
     ON CONFLICT (owner_id, seed_key) DO NOTHING`,
    [date],
  );
  return result.rowCount;
};

const pendingReminders = async () => {
  const result = await pool.query(
    `SELECT
       preference.owner_id,
       preference.recipient_email,
       preference.timezone,
       task.id AS task_id,
       task.calendar_event_id,
       task.company_id,
       task.due_date,
       event.title AS event_title,
       company.name AS company_name
     FROM public.reminder_preferences preference
     JOIN public.tasks task ON task.owner_id = preference.owner_id
     JOIN public.calendar_events event
       ON event.id = task.calendar_event_id
      AND event.owner_id = task.owner_id
     JOIN public.companies company
       ON company.id = task.company_id
      AND company.owner_id = task.owner_id
     WHERE preference.company_id IS NULL
       AND preference.daily_greeting_enabled = true
       AND preference.status = 'Enabled'
       AND preference.recipient_email IS NOT NULL
       AND btrim(preference.recipient_email) <> ''
       AND task.category = 'Social Media'
       AND task.seed_key LIKE 'calendar-event-post:%'
       AND task.status NOT IN ('Done', 'Awaiting Approval')
       AND task.reminder_sent_at IS NULL
       AND event.status <> 'Cancelled'
       AND task.due_date = ((now() AT TIME ZONE preference.timezone)::date + 1)
       AND NOT EXISTS (
         SELECT 1
         FROM public.social_posts post
         WHERE post.owner_id = task.owner_id
           AND post.company_id = task.company_id
           AND post.calendar_event_id = task.calendar_event_id
       )
     ORDER BY preference.owner_id, task.due_date, company.name, event.title`,
  );
  return result.rows;
};

const pendingPaymentReminders = async () => {
  const result = await pool.query(
    `SELECT
       preference.owner_id,
       preference.recipient_email,
       payment.id AS payment_id,
       payment.invoice_no,
       payment.title,
       payment.due_date,
       payment.next_reminder,
       company.name AS company_name,
       GREATEST(0, round(
         COALESCE(payment.amount, 0) * (1 + COALESCE(payment.tax_rate, 0) / 100)
         - COALESCE(payment.discount, 0) - COALESCE(payment.amount_received, 0)
       )) AS balance_due
     FROM public.reminder_preferences preference
     JOIN public.payments payment ON payment.owner_id = preference.owner_id
     JOIN public.companies company
       ON company.id = payment.company_id
      AND company.owner_id = payment.owner_id
     LEFT JOIN public.user_profiles profile ON profile.id = preference.owner_id
     WHERE preference.company_id IS NULL
       AND preference.payment_reminder_enabled = true
       AND preference.status = 'Enabled'
       AND preference.recipient_email IS NOT NULL
       AND btrim(preference.recipient_email) <> ''
       AND COALESCE(profile.notify_payments, true) = true
       AND payment.is_demo = false
       AND payment.status NOT IN ('Paid', 'Cancelled', 'Draft')
       AND payment.next_reminder IS NOT NULL
       AND payment.next_reminder <= ((now() AT TIME ZONE preference.timezone)::date)
       AND (payment.last_reminder_sent_at IS NULL OR payment.last_reminder_sent_at::date < payment.next_reminder)
       AND GREATEST(0, round(
         COALESCE(payment.amount, 0) * (1 + COALESCE(payment.tax_rate, 0) / 100)
         - COALESCE(payment.discount, 0) - COALESCE(payment.amount_received, 0)
       )) > 0
     ORDER BY preference.owner_id, payment.next_reminder, company.name, payment.invoice_no`,
  );
  return result.rows;
};

const sendReminderEmail = async ({ ownerId, recipient, rows, reminderDate }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Email reminders are enabled but RESEND_API_KEY or EMAIL_FROM is not configured on the Neon Function.');
  }

  const items = rows.map((row) => (
    `<li><strong>${escapeHtml(row.event_title)}</strong> — ${escapeHtml(row.company_name)} (due ${escapeHtml(row.due_date)})</li>`
  )).join('');
  const subject = `Greeting post due tomorrow: ${rows.length} task${rows.length === 1 ? '' : 's'}`;
  const text = [
    'These event greeting posts are due tomorrow and have no linked social post yet:',
    ...rows.map((row) => `- ${row.event_title} — ${row.company_name} (due ${row.due_date})`),
    '',
    'Open Webofolio, create the post, link its event, and mark the task done.',
  ].join('\n');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `webofolio-greeting-${ownerId}-${reminderDate}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      text,
      html: `<p>These event greeting posts are due tomorrow and have no linked social post yet:</p><ul>${items}</ul><p>Open Webofolio, create the post, link its event, and mark the task done.</p>`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend could not deliver a greeting reminder (HTTP ${response.status}). Verify the API key and sender domain.`);
  }

  await pool.query(
    `UPDATE public.tasks
     SET reminder_sent_at = now()
     WHERE id = ANY($1::uuid[])
       AND status NOT IN ('Done', 'Awaiting Approval')
       AND reminder_sent_at IS NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.social_posts post
         WHERE post.owner_id = tasks.owner_id
           AND post.company_id = tasks.company_id
           AND post.calendar_event_id = tasks.calendar_event_id
       )`,
    [rows.map((row) => row.task_id)],
  );
  return rows.length;
};

const sendPaymentReminderEmail = async ({ ownerId, recipient, rows, reminderDate }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Payment reminders are enabled but RESEND_API_KEY or EMAIL_FROM is not configured on the Neon Function.');
  }

  const items = rows.map((row) => (
    `<li><strong>${escapeHtml(row.invoice_no || row.title)}</strong> — ${escapeHtml(row.company_name)}: ₹${Number(row.balance_due).toLocaleString('en-IN')} outstanding${row.due_date ? ` (due ${escapeHtml(row.due_date)})` : ''}</li>`
  )).join('');
  const subject = `Payment follow-up due: ${rows.length} invoice${rows.length === 1 ? '' : 's'}`;
  const text = [
    'These invoices have a payment follow-up due:',
    ...rows.map((row) => `- ${row.invoice_no || row.title} — ${row.company_name}: ₹${Number(row.balance_due).toLocaleString('en-IN')} outstanding${row.due_date ? ` (due ${row.due_date})` : ''}`),
    '',
    'Open Webofolio to record a receipt, schedule the next follow-up, or mark the balance paid.',
  ].join('\n');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `webofolio-payment-${ownerId}-${reminderDate}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      text,
      html: `<p>These invoices have a payment follow-up due:</p><ul>${items}</ul><p>Open Webofolio to record a receipt, schedule the next follow-up, or mark the balance paid.</p>`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend could not deliver a payment reminder (HTTP ${response.status}). Verify the API key and sender domain.`);
  }

  await pool.query(
    `UPDATE public.payments
     SET last_reminder_sent_at = now(),
         next_reminder = NULL,
         last_follow_up = $2::date
     WHERE id = ANY($1::uuid[])
       AND status NOT IN ('Paid', 'Cancelled', 'Draft')`,
    [rows.map((row) => row.payment_id), reminderDate],
  );
  return rows.length;
};

export const runDailyGreetingReminders = async (now = new Date()) => {
  const date = localDateInIndia(now);
  const { inserted: observancesAdded, failedYears: holidayFeedWarnings } = await saveObservances(date);
  const tasksAdded = await createGreetingTasks(date);
  const reminders = await pendingReminders();
  const groups = new Map();
  for (const row of reminders) {
    const reminderDate = localDateInIndia(now);
    const key = `${row.owner_id}:${row.recipient_email}:${reminderDate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        ownerId: row.owner_id,
        recipient: row.recipient_email,
        reminderDate,
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  }

  let remindersSent = 0;
  for (const group of groups.values()) {
    remindersSent += await sendReminderEmail(group);
  }
  const paymentReminders = await pendingPaymentReminders();
  const paymentGroups = new Map();
  for (const row of paymentReminders) {
    const key = `${row.owner_id}:${row.recipient_email}:${date}`;
    if (!paymentGroups.has(key)) {
      paymentGroups.set(key, { ownerId: row.owner_id, recipient: row.recipient_email, reminderDate: date, rows: [] });
    }
    paymentGroups.get(key).rows.push(row);
  }
  let paymentRemindersSent = 0;
  for (const group of paymentGroups.values()) {
    paymentRemindersSent += await sendPaymentReminderEmail(group);
  }
  return { date, observancesAdded, holidayFeedWarnings, tasksAdded, remindersSent, paymentRemindersSent };
};

export default {
  async fetch(request) {
    const delivery = await parseTriggerDelivery(request);
    if (!delivery.ok) {
      return Response.json({ error: delivery.error }, { status: delivery.error === 'invalid_body' ? 400 : 401 });
    }
    if (delivery.invocation.type !== 'schedule') {
      return Response.json({ error: 'schedule_trigger_required' }, { status: 400 });
    }
    if (!process.env.DATABASE_URL) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    try {
      const result = await runDailyGreetingReminders();
      return Response.json(result);
    } catch (error) {
      console.error('Daily greeting reminder job failed:', error?.message || error);
      return Response.json({ error: error?.message || 'daily_greeting_job_failed' }, { status: 500 });
    }
  },
};
