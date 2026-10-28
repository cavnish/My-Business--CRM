import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, CalendarDays, PhoneCall, Wallet, CheckCircle2, ListTodo } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import TodayList from '@/components/dashboard/TodayList';
import { useToast } from '@/components/ui/use-toast';
import StatusBadge from '@/components/shared/StatusBadge';
import { balanceDue, fmtDay, inr, todayISO, total } from '@/lib/format';

export default function MyDay() {
  const { toast } = useToast();
  const [data, setData] = useState({ tasks: [], leads: [], payments: [], events: [], companies: [] });
  const today = todayISO();

  const load = async () => {
    try {
      const [tasks, leads, payments, events, companies] = await Promise.all([
        neon.entities.Task.filter({}, { limit: 300 }),
        neon.entities.Lead.filter({}, { limit: 200 }),
        neon.entities.Payment.filter({}, { limit: 200 }),
        neon.entities.CalendarEvent.filter({ date: today }, { limit: 20 }),
        neon.entities.Company.list({ limit: 60 }),
      ]);
      setData({
        tasks: tasks.items || [], leads: leads.items || [], payments: payments.items || [],
        events: events.items || [], companies: companies.items || [],
      });
    } catch (error) {
      toast({ title: 'Could not load your day', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  useEffect(() => { load(); }, []);

  const companiesById = useMemo(() => Object.fromEntries(data.companies.map((c) => [c.id, c])), [data.companies]);
  const todayTasks = data.tasks.filter((t) => t.status !== 'Done' && String(t.due_date).slice(0, 10) === today);
  const overdue = data.tasks.filter((t) => t.status !== 'Done' && t.due_date && String(t.due_date).slice(0, 10) < today);
  const completedToday = data.tasks.filter((t) => t.status === 'Done' && String(t.completed_date).slice(0, 10) === today);
  const followUps = data.leads.filter((l) => l.next_follow_up && l.next_follow_up <= today && !['Won', 'Lost'].includes(l.status));
  const paymentPrompts = data.payments.filter((p) => ['Pending', 'Partially Paid', 'Overdue'].includes(p.status) && p.next_reminder && p.next_reminder <= today);
  const hoursPlanned = total([...todayTasks, ...overdue], 'estimate_hours');
  const hoursDone = total(completedToday, 'estimate_hours');

  const toggle = async (task) => {
    const done = task.status === 'Done';
    const updated = { ...task, status: done ? 'To Do' : 'Done', completed_date: done ? null : today };
    try {
      await neon.entities.Task.update(task.id, { status: updated.status, completed_date: updated.completed_date });
      setData((prev) => ({ ...prev, tasks: prev.tasks.map((item) => (item.id === task.id ? updated : item)) }));
    } catch (error) {
      toast({ title: 'Could not update task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title="My day"
        description="A focused list of what must move today, and what needs a nudge."
        actions={<Link to="/tasks?new=1" className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Add a task</Link>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Due today', value: todayTasks.length, icon: ListTodo },
          { label: 'Overdue', value: overdue.length, icon: AlarmClock, danger: overdue.length > 0 },
          { label: 'Completed today', value: completedToday.length, icon: CheckCircle2 },
          { label: 'Hours planned', value: `${hoursPlanned}h`, hint: `${hoursDone}h logged`, icon: CalendarDays },
        ].map(({ label, value, hint, icon: Icon, danger }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <Icon className={`h-3.5 w-3.5 ${danger ? 'text-destructive' : 'text-muted-foreground/70'}`} />
            </div>
            <p className={`num mt-2 font-display text-[28px] leading-none ${danger ? 'text-destructive' : ''}`}>{value}</p>
            {hint && <p className="mt-1 text-[10.5px] text-muted-foreground">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TodayList title="Due today" subtitle={`${todayTasks.length} tasks · ${hoursPlanned}h planned`} tasks={todayTasks} companiesById={companiesById} onToggle={toggle} emptyText="Nothing due today." />
          {overdue.length > 0 && (
            <TodayList title="Overdue" subtitle="Clear these first" tasks={overdue} companiesById={companiesById} onToggle={toggle} />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[12.5px] font-medium">Follow-ups due</h2>
              <span className="ml-auto text-[10.5px] text-muted-foreground">{followUps.length}</span>
            </div>
            <div className="divide-y divide-border/70">
              {followUps.length === 0 && <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">No follow-ups pending.</p>}
              {followUps.slice(0, 5).map((lead) => (
                <Link key={lead.id} to="/leads" className="block px-4 py-2.5 transition hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] font-medium">{lead.name}</p>
                    <StatusBadge status={lead.status} dot={false} />
                  </div>
                  <p className="truncate text-[10.5px] text-muted-foreground">{companiesById[lead.company_id]?.name} · {lead.phone || lead.email || 'No contact saved'}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[12.5px] font-medium">Payment nudges</h2>
            </div>
            <div className="divide-y divide-border/70">
              {paymentPrompts.length === 0 && <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">No reminders scheduled.</p>}
              {paymentPrompts.slice(0, 4).map((p) => (
                <Link key={p.id} to="/payments" className="block px-4 py-2.5 hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px]">{companiesById[p.company_id]?.name || 'Client'}</p>
                    <span className="num text-[12px] font-medium">{inr(balanceDue(p))}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground">{p.pending_reason || 'Follow up on payment'}</p>
                </Link>
              ))}
            </div>
            <Link to="/payments" className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground hover:text-foreground">
              Receivables <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[12.5px] font-medium">On the calendar</h2>
            </div>
            {data.events.length === 0 ? (
              <p className="py-4 text-center text-[11.5px] text-muted-foreground">Nothing scheduled today.</p>
            ) : data.events.map((e) => (
              <div key={e.id} className="border-t border-border/60 py-2 first:border-0 first:pt-0">
                <p className="text-[12px]">{e.title}</p>
                <p className="text-[10.5px] text-muted-foreground">{e.category} · {fmtDay(e.date)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-[12.5px] font-medium">Daily summary</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          {completedToday.length} done · {todayTasks.length} still due · {overdue.length} overdue · {followUps.length} follow-ups waiting.
          {overdue.length > 0 ? ' Start with the oldest overdue task.' : ' You are on top of the day.'}
        </p>
      </div>
    </div>
  );
}