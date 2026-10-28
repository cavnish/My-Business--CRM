import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, CheckSquare, Wallet, ArrowUpRight, FileText, Plus } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import StatCard from '@/components/shared/StatCard';
import TodayList from '@/components/dashboard/TodayList';
import ReceivablesCard from '@/components/dashboard/ReceivablesCard';
import CompanyPortfolio from '@/components/dashboard/CompanyPortfolio';
import PipelineCard from '@/components/dashboard/PipelineCard';
import UpcomingCard from '@/components/dashboard/UpcomingCard';
import { useToast } from '@/components/ui/use-toast';
import { addDays, balanceDue, effectivePaymentStatus, isOpenInvoice, isOverdue, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';

const empty = { companies: [], tasks: [], leads: [], projects: [], payments: [], events: [], social: [] };

export default function Dashboard() {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const today = todayISO();

  const load = async () => {
    try {
      if (!isAdmin) {
        const [companies, tasks, projects] = await Promise.all([
          neon.entities.Company.list({ limit: 60 }),
          neon.entities.Task.filter({}, { limit: 300 }),
          neon.entities.Project.filter({}, { limit: 200 }),
        ]);
        setData({
          ...empty,
          companies: companies.items || [],
          tasks: tasks.items || [],
          projects: projects.items || [],
        });
        return;
      }
      const [companies, tasks, leads, projects, payments, events, social] = await Promise.all([
        neon.entities.Company.list({ sort: '-created_date', limit: 60 }),
        neon.entities.Task.filter({}, { limit: 300 }),
        neon.entities.Lead.filter({}, { limit: 300 }),
        neon.entities.Project.filter({}, { limit: 200 }),
        neon.entities.Payment.filter({}, { limit: 300 }),
        neon.entities.CalendarEvent.filter({ date: { $gte: today } }, { sort: 'date', limit: 200 }),
        neon.entities.SocialPost.filter({ scheduled_date: { $gte: today } }, { sort: 'scheduled_date', limit: 20 }),
      ]);
      setData({
        companies: companies.items || [],
        tasks: tasks.items || [],
        leads: leads.items || [],
        projects: projects.items || [],
        payments: payments.items || [],
        events: events.items || [],
        social: social.items || [],
      });
    } catch (error) {
      toast({ title: 'Could not load dashboard', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isAdmin]);

  const companiesById = useMemo(
    () => Object.fromEntries(data.companies.map((c) => [c.id, c])),
    [data.companies],
  );

  const openLeads = data.leads.filter((l) => !l.is_demo && !['Won', 'Lost'].includes(l.status));
  const pipelineValue = openLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
  const openPayments = data.payments.filter(isOpenInvoice);
  const outstanding = openPayments.reduce((s, p) => s + balanceDue(p), 0);
  const dueToday = data.tasks.filter((t) => t.status !== 'Done' && t.due_date && String(t.due_date).slice(0, 10) === today);
  const overdue = data.tasks.filter((t) => t.status !== 'Done' && isOverdue(t.due_date));
  const focusTasks = [...overdue, ...dueToday.filter((t) => !overdue.find((o) => o.id === t.id))]
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  const metrics = useMemo(() => {
    /** @type {Record<string, {openTasks: number, pipeline: number, outstanding: number}>} */
    const map = {};
    data.companies.forEach((c) => { map[c.id] = { openTasks: 0, pipeline: 0, outstanding: 0 }; });
    data.tasks.forEach((t) => { if (!t.is_demo && t.status !== 'Done' && map[t.company_id]) map[t.company_id].openTasks += 1; });
    openLeads.forEach((l) => { if (map[l.company_id]) map[l.company_id].pipeline += Number(l.estimated_value || 0); });
    openPayments.forEach((p) => { if (map[p.company_id]) map[p.company_id].outstanding += balanceDue(p); });
    return map;
  }, [data, openLeads, openPayments]);

  const upcoming = useMemo(() => {
    const items = [];
    data.events.filter((event) => event.status !== 'Cancelled').forEach((e) => items.push({ date: e.date, label: e.title, meta: e.category, type: 'event' }));
    data.social.forEach((s) => items.push({ date: s.scheduled_date, label: s.title, meta: `${companiesById[s.company_id]?.name || 'Client'} · ${s.platform}`, type: 'social' }));
    data.projects.filter((p) => p.status !== 'Completed' && p.deadline && p.deadline >= today).forEach((p) => items.push({ date: p.deadline, label: `${p.name} due`, meta: companiesById[p.company_id]?.name || 'Project', type: 'project' }));
    return items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [data, companiesById, today]);
  const eventReminders = useMemo(() => data.events
    .filter((event) => event.status !== 'Cancelled')
    .map((event) => ({ event, date: addDays(-2, event.date) }))
    .filter(({ date }) => date >= today && date <= addDays(30))
    .map(({ event, date }) => ({
      date,
      label: `Prepare for ${event.title}`,
      meta: `Event ${event.date} · ${event.category || 'Calendar event'}`,
      type: 'reminder',
    }))
    .sort((a, b) => a.date.localeCompare(b.date)), [data.events, today]);

  const toggleTask = async (task) => {
    const done = task.status === 'Done';
    const patch = { status: done ? 'To Do' : 'Done', completed_date: done ? null : today };
    setData((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)) }));
    try {
      await neon.entities.Task.update(task.id, patch);
    } catch (error) {
      setData((prev) => ({ ...prev, tasks: prev.tasks.map((item) => (item.id === task.id ? task : item)) }));
      toast({ title: 'Could not update task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const longDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!isAdmin) {
    const openTasks = data.tasks.filter((task) => task.status !== 'Done');
    const pendingApproval = openTasks.filter((task) => task.status === 'Awaiting Approval').length;
    return (
      <div className="fade-up">
        <div className="mb-7">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{longDate}</p>
          <h1 className="font-display text-[32px] leading-[1.05] sm:text-[40px]">Your work.</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Only projects and tasks assigned to your account appear here.</p>
        </div>
        {loading ? <div className="h-48 animate-pulse rounded-2xl border border-border bg-card/60" /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl">Assigned tasks</h2>
                <span className="text-xs text-muted-foreground">{openTasks.length} open · {pendingApproval} awaiting review</span>
              </div>
              {openTasks.length === 0 ? <EmptyState icon={CheckSquare} title="No assigned tasks" description="Your administrator will assign work to you here." action={null} /> : (
                <div className="divide-y divide-border/70">
                  {openTasks.slice(0, 12).map((task) => (
                    <div key={task.id} className="flex flex-wrap items-center gap-2 py-3">
                      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                      <select
                        aria-label={`Update status for ${task.title}`}
                        value={task.status}
                        disabled={task.status === 'Awaiting Approval'}
                        onChange={async (event) => {
                          const status = event.target.value === 'Done' ? 'Awaiting Approval' : event.target.value;
                          try {
                            await neon.entities.Task.update(task.id, { status });
                            setData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status } : item) }));
                          } catch (error) {
                            toast({ title: 'Could not update task', description: error?.message || 'Please try again.', variant: 'destructive' });
                          }
                        }}
                        className="h-8 max-w-36 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {['To Do', 'In Progress', 'Blocked', 'Awaiting Approval'].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <Button className="mt-3" variant="outline" asChild><Link to="/tasks">View all tasks</Link></Button>
            </section>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 font-display text-xl">Assigned projects</h2>
              {data.projects.length === 0 ? <EmptyState icon={Building2} title="No assigned projects" description="Projects assigned to you will appear here." action={null} /> : (
                <div className="space-y-2">
                  {data.projects.map((project) => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="block rounded-xl border border-border/70 p-3 transition hover:bg-muted/40">
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{project.status}{project.deadline ? ` · Due ${String(project.deadline).slice(0, 10)}` : ''}</p>
                    </Link>
                  ))}
                </div>
              )}
              <Button className="mt-3" variant="outline" asChild><Link to="/projects">View all projects</Link></Button>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{longDate}</p>
          <h1 className="font-display text-[32px] leading-[1.05] sm:text-[40px]">{greeting}.</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {data.companies.length} companies, {focusTasks.length} things needing you today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/bills" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground transition hover:text-foreground">
            <FileText className="h-3.5 w-3.5" /> Monthly bill
          </Link>
          <Link to="/leads?new=1" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Add lead
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Active clients" value={`${data.companies.filter((c) => c.status === 'active').length}/${data.companies.length}`} hint="companies in workspace" accent="text-muted-foreground" icon={Building2} to="/companies" />
        <StatCard label="Open pipeline" value={pipelineValue >= 100000 ? `₹${(pipelineValue / 100000).toFixed(1)}L` : `₹${(pipelineValue / 1000).toFixed(0)}k`} hint={`${openLeads.length} live leads`} accent="text-muted-foreground" icon={Users} to="/leads" />
        <StatCard label="Due today" value={dueToday.length} hint={overdue.length ? `${overdue.length} overdue` : 'nothing overdue'} accent={overdue.length ? 'text-destructive' : 'text-emerald-600'} icon={CheckSquare} to="/tasks" />
        <StatCard label="Outstanding" value={outstanding >= 100000 ? `₹${(outstanding / 100000).toFixed(1)}L` : `₹${(outstanding / 1000).toFixed(0)}k`} hint={`${openPayments.length} open invoices`} accent="text-muted-foreground" icon={Wallet} to="/payments" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayList tasks={focusTasks.slice(0, 7)} companiesById={companiesById} onToggle={toggleTask} />
        </div>
          <ReceivablesCard payments={openPayments.map((payment) => ({ ...payment, status: effectivePaymentStatus(payment) }))} companiesById={companiesById} outstanding={outstanding} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CompanyPortfolio companies={data.companies} metrics={metrics} loading={loading} />
        </div>
        <div className="space-y-4">
          <PipelineCard leads={data.leads.filter((lead) => !lead.is_demo)} />
          <UpcomingCard items={upcoming} />
          <UpcomingCard items={eventReminders} title="Event reminders · 2 days before" />
        </div>
      </div>

      <p className="mt-4 text-center text-[10.5px] text-muted-foreground">
        DEMO examples are clearly labeled and excluded from live pipeline and payment totals. Replace or delete them as real work is confirmed.
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-r from-[#F2EEE4] to-[#F8F6F0] px-5 py-4">
        <div>
          <p className="text-[13px] font-medium">Month-end is the moment for a clean bill.</p>
          <p className="text-[11.5px] text-muted-foreground">Pull the month’s completed work into an invoice or a client work report.</p>
        </div>
        <Link to="/bills" className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-[12px] font-medium shadow-sm transition hover:shadow">
          Build this month’s bill <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
