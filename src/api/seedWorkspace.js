import { neon } from '@/api/neonDataClient';

const companiesToSeed = [
  { name: 'Rack & Stack Storage Systems Pvt. Ltd.', domain: 'rackandstack.in', key: 'rack-and-stack' },
  { name: 'Arrowline Logistics', domain: 'arrowlinelogistics.in', key: 'arrowline-logistics' },
  { name: 'MSNSS – M S HVAC Engineers', domain: 'msnss.in', key: 'msnss-hvac' },
  { name: 'Arya Enterprises', domain: 'aryaenterprise.in', key: 'arya-enterprises' },
];

const normalizeDomain = (value = '') =>
  String(value).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();

const normalizeName = (value = '') => String(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const ensureSeededRecord = async (entityName, seedKey, record, created) => {
  const entity = neon.entities[entityName];
  const existing = await entity.filter({ seed_key: seedKey }, { limit: 1 });
  if (existing.items[0]) return existing.items[0];

  try {
    const saved = await entity.create({ ...record, seed_key: seedKey });
    created[entityName] = (created[entityName] || 0) + 1;
    return saved;
  } catch (error) {
    const retry = await entity.filter({ seed_key: seedKey }, { limit: 1 });
    if (retry.items[0]) return retry.items[0];
    throw error;
  }
};

const ensureCompany = async (companyInfo, companies, created) => {
  const existing = companies.find((company) =>
    normalizeDomain(company.domain) === companyInfo.domain
    || normalizeName(company.name) === normalizeName(companyInfo.name),
  );
  if (existing) {
    if (!existing.domain) {
      const saved = await neon.entities.Company.update(existing.id, { domain: companyInfo.domain });
      existing.domain = saved.domain;
    }
    return existing;
  }

  const saved = await ensureSeededRecord('Company', `known-company-${companyInfo.key}`, {
    name: companyInfo.name,
    domain: companyInfo.domain,
    status: 'To Confirm',
    profile_status: 'To Confirm',
    services: [],
    website_notes: 'Website ownership, technical details, and access are To Confirm.',
    notes: 'Contact details, services, branding, and commercial terms are To Confirm.',
  }, created);
  companies.push(saved);
  return saved;
};

export const ensureWorkspaceSeed = async () => {
  const seedState = await neon.entities.WorkspaceSeedState.filter({}, { limit: 1 });
  if (seedState.items[0]?.seed_version >= 1) return { seeded: false, created: {} };

  const created = {};
  const companyResult = await neon.entities.Company.list({ limit: 1000 });
  const companies = companyResult.items || [];

  for (const info of companiesToSeed) {
    const company = await ensureCompany(info, companies, created);
    const prefix = info.key;

    await ensureSeededRecord('CompanyWebsite', `website-${prefix}`, {
      company_id: company.id,
      name: 'Primary website',
      url: `https://${info.domain}`,
      domain: info.domain,
      status: 'To Confirm',
      is_primary: true,
    }, created);

    const brandProfiles = await neon.entities.CompanyBrandProfile.filter(
      { company_id: company.id },
      { limit: 1 },
    );
    if (!brandProfiles.items[0]) {
      await neon.entities.CompanyBrandProfile.create({
        company_id: company.id,
        status: 'To Confirm',
        colors: {},
        typography: {},
        voice_notes: 'Brand guidelines are To Confirm.',
      });
      created.CompanyBrandProfile = (created.CompanyBrandProfile || 0) + 1;
    }

    await ensureSeededRecord('CompanyService', `services-${prefix}`, {
      company_id: company.id,
      name: 'Service details — To Confirm',
      status: 'To Confirm',
    }, created);
    await ensureSeededRecord('CommercialAgreement', `agreement-${prefix}`, {
      company_id: company.id,
      title: 'Historical commercial agreement — To Confirm',
      status: 'To Confirm',
      terms: {},
    }, created);
    await ensureSeededRecord('Lead', `demo-lead-${prefix}`, {
      company_id: company.id,
      name: 'DEMO — Lead details to confirm',
      company_name: 'To Confirm',
      source: 'DEMO',
      service: 'To Confirm',
      status: 'To Confirm',
      priority: 'Low',
      notes: 'DEMO record only. Contact details, needs, and follow-up dates are To Confirm.',
      is_demo: true,
    }, created);
    await ensureSeededRecord('Project', `demo-project-${prefix}`, {
      company_id: company.id,
      name: 'DEMO — Project status to confirm',
      description: 'DEMO project. Scope, owner, dates, and commercial value are To Confirm.',
      status: 'Planned',
      priority: 'Low',
      notes: 'DEMO record only; confirm before using as a real project.',
      is_demo: true,
    }, created);
    await ensureSeededRecord('Task', `demo-task-${prefix}`, {
      company_id: company.id,
      title: 'DEMO — Confirm initial task list',
      description: 'Replace this sample task with confirmed work.',
      category: 'Administration',
      priority: 'Low',
      status: 'To Do',
      notes: 'DEMO record only. Due date and assignee are To Confirm.',
      is_demo: true,
    }, created);
    await ensureSeededRecord('Payment', `demo-payment-${prefix}`, {
      company_id: company.id,
      title: 'DEMO — Payment details to confirm',
      kind: 'To Confirm',
      status: 'To Confirm',
      amount_received: 0,
      notes: 'DEMO invoice example only. Not an invoice or payment transaction.',
      is_demo: true,
    }, created);
    await ensureSeededRecord('SeoTask', `demo-seo-${prefix}`, {
      company_id: company.id,
      title: 'DEMO — SEO baseline to confirm',
      type: 'To Confirm',
      status: 'Pending',
      priority: 'Low',
      notes: 'DEMO record only. Target pages and keywords are To Confirm.',
      is_demo: true,
    }, created);
    await ensureSeededRecord('SocialPost', `demo-social-post-${prefix}`, {
      company_id: company.id,
      platform: 'To Confirm',
      title: 'DEMO — Social plan to confirm',
      status: 'Idea',
      notes: 'DEMO draft only. Do not publish without approval.',
      is_demo: true,
    }, created);
    await ensureSeededRecord('ProjectTemplate', `demo-project-template-${prefix}`, {
      company_id: company.id,
      name: 'DEMO — Project template to confirm',
      status: 'Planned',
      tasks: [],
      is_demo: true,
    }, created);
    await ensureSeededRecord('RecurringTaskSchedule', `demo-daily-schedule-${prefix}`, {
      company_id: company.id,
      title: 'DEMO — Daily task schedule to configure',
      schedule_rule: { frequency: 'daily' },
      timezone: 'Asia/Kolkata',
      enabled: false,
      status: 'To Confirm',
      is_demo: true,
    }, created);
    await ensureSeededRecord('RecurringTaskSchedule', `demo-weekly-schedule-${prefix}`, {
      company_id: company.id,
      title: 'DEMO — Weekly task schedule to configure',
      schedule_rule: { frequency: 'weekly' },
      timezone: 'Asia/Kolkata',
      enabled: false,
      status: 'To Confirm',
      is_demo: true,
    }, created);
    await ensureSeededRecord('SocialWorkspace', `demo-social-workspace-${prefix}`, {
      company_id: company.id,
      platform: 'To Confirm',
      status: 'To Confirm',
      settings: {},
      is_demo: true,
    }, created);

    const integrations = await neon.entities.IntegrationConfiguration.filter(
      { company_id: company.id, provider: 'Resend' },
      { limit: 1 },
    );
    if (!integrations.items[0]) {
      await neon.entities.IntegrationConfiguration.create({
        company_id: company.id,
        provider: 'Resend',
        status: 'Not configured',
        settings: {},
        enabled: false,
      });
      created.IntegrationConfiguration = (created.IntegrationConfiguration || 0) + 1;
    }

    const reminders = await neon.entities.ReminderPreference.filter(
      { company_id: company.id },
      { limit: 1 },
    );
    if (!reminders.items[0]) {
      await neon.entities.ReminderPreference.create({
        company_id: company.id,
        daily_greeting_enabled: false,
        timezone: 'Asia/Kolkata',
        local_time: '21:00',
        email_provider: 'Resend',
        status: 'Not configured',
      });
      created.ReminderPreference = (created.ReminderPreference || 0) + 1;
    }
  }

  try {
    await neon.entities.WorkspaceSeedState.create({ seed_version: 1 });
  } catch (error) {
    const retry = await neon.entities.WorkspaceSeedState.filter({}, { limit: 1 });
    if (!retry.items[0]) throw error;
  }

  return { seeded: true, created };
};
