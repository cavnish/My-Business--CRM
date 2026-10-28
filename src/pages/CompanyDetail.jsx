import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Globe, Check, Plus, Building2 } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import CompanyMark from '@/components/shared/CompanyMark';
import StatusBadge from '@/components/shared/StatusBadge';
import CompanyRecordList from '@/components/companies/CompanyRecordList';
import CompanyOverview from '@/components/companies/CompanyOverview';
import CompanyWebsite from '@/components/companies/CompanyWebsite';
import EmptyState from '@/components/shared/EmptyState';
import DeleteButton from '@/components/shared/DeleteButton';
import { ProgressBar } from '@/components/shared/Field';
import CompanyForm from '@/components/forms/CompanyForm';
import { useToast } from '@/components/ui/use-toast';
import LeadForm from '@/components/forms/LeadForm';
import ProjectForm from '@/components/forms/ProjectForm';
import TaskForm from '@/components/forms/TaskForm';
import SeoTaskForm from '@/components/forms/SeoTaskForm';
import SocialPostForm from '@/components/forms/SocialPostForm';
import PaymentForm from '@/components/forms/PaymentForm';
import NoteForm from '@/components/forms/NoteForm';
import { balanceDue, fmtDate, inr, isOpenInvoice, relative, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';

const TABS = ['Overview', 'Leads', 'Projects', 'Tasks', 'SEO', 'Social', 'Payments', 'Notes', 'Website'];

export default function CompanyDetail() {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [records, setRecords] = useState({ leads: [], projects: [], tasks: [], seo: [], social: [], payments: [], notes: [], agreements: [], profiles: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const [editor, setEditor] = useState(null);
  const [companyForm, setCompanyForm] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const load = async () => {
    try {
    const [c, leads, projects, tasks, seo, social, payments, notes, agreements, profiles] = await Promise.all([
      neon.entities.Company.get(id),
      neon.entities.Lead.filter({ company_id: id }, { sort: '-created_date', limit: 100 }),
      neon.entities.Project.filter({ company_id: id }, { sort: '-created_date', limit: 100 }),
      neon.entities.Task.filter({ company_id: id }, { sort: 'due_date', limit: 200 }),
      neon.entities.SeoTask.filter({ company_id: id }, { sort: 'due_date', limit: 100 }),
      neon.entities.SocialPost.filter({ company_id: id }, { sort: 'scheduled_date', limit: 100 }),
      neon.entities.Payment.filter({ company_id: id }, { sort: '-due_date', limit: 100 }),
      neon.entities.Note.filter({ company_id: id }, { limit: 100 }),
      isAdmin ? neon.entities.CommercialAgreement.filter({ company_id: id, is_demo: false }, { limit: 100 }) : Promise.resolve({ items: [] }),
      isAdmin ? neon.entities.SocialWorkspace.filter({ company_id: id, is_demo: false }, { limit: 100 }) : Promise.resolve({ items: [] }),
    ]);
    setCompany(c);
    setRecords({
      leads: leads.items || [], projects: projects.items || [], tasks: tasks.items || [],
      seo: seo.items || [], social: social.items || [], payments: payments.items || [], notes: notes.items || [],
      agreements: agreements.items || [], profiles: profiles.items || [],
    });
    } catch (error) {
      toast({ title: 'Could not load company workspace', description: error?.message || 'Please try again.', variant: 'destructive' });
      setCompany(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, isAdmin]);

  useEffect(() => {
    if (loading || company) return;
    const meta = document.createElement('meta');
    meta.name = 'prerender-status-code';
    meta.content = '404';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, [loading, company]);

  const metrics = useMemo(() => ({
    openTasks: records.tasks.filter((t) => t.status !== 'Done').length,
    pipeline: records.leads.filter((l) => !['Won', 'Lost'].includes(l.status)).reduce((s, l) => s + Number(l.estimated_value || 0), 0),
    outstanding: records.payments.filter(isOpenInvoice).reduce((s, p) => s + balanceDue(p), 0),
  }), [records]);

  const upcoming = useMemo(() => {
    const items = [];
    records.projects.filter((p) => p.deadline && p.status !== 'Completed').forEach((p) => items.push({ label: `${p.name} due`, date: p.deadline }));
    records.seo.filter((s) => s.due_date && s.status !== 'Done').forEach((s) => items.push({ label: s.title, date: s.due_date }));
    records.payments.filter((p) => p.due_date && isOpenInvoice(p)).forEach((p) => items.push({ label: `Invoice ${p.invoice_no || ''} due`, date: p.due_date }));
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [records]);

  const remove = async (entity, record) => {
    await neon.entities[entity].delete(record.id);
    await load();
  };

  const toggleTask = async (task) => {
    try {
      await neon.entities.Task.update(task.id, {
        status: task.status === 'Done' ? 'To Do' : 'Done',
        completed_date: task.status === 'Done' ? null : todayISO(),
      });
      await load();
    } catch (error) {
      toast({ title: 'Could not update task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const editBtn = (type, record) => (
    <button onClick={() => setEditor({ type, record })} className="rounded-md p-1.5 text-muted-foreground/70 transition hover:bg-muted hover:text-foreground" title="Edit">
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );

  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl border border-border bg-card/60" />;
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={Building2} title="Company not found" description="This workspace may have been deleted or the link is wrong." action={<Link to="/companies" className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Back to companies</Link>} />
      </div>
    );
  }

  const companyOption = [{ value: company.id, label: company.name }];

  return (
    <div className="fade-up">
      <Link to="/companies" className="mb-4 inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All companies
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <CompanyMark company={company} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[28px] leading-tight sm:text-[34px]">{company.name}</h1>
              <StatusBadge status={company.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              {company.domain && (
                <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <Globe className="h-3 w-3" /> {company.domain}
                </a>
              )}
              <span>·</span>
              <span>{company.industry || 'No industry set'}</span>
              {company.service_package && <><span>·</span><span>{company.service_package}</span></>}
            </div>
          </div>
        </div>
        <button onClick={() => setCompanyForm(true)} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 py-2 text-[12px] transition hover:border-primary/30">
          <Pencil className="h-3.5 w-3.5" /> Edit company
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Monthly fee', company.monthly_fee ? inr(company.monthly_fee) : '—'],
          ['Open tasks', metrics.openTasks],
          ['Open pipeline', inr(metrics.pipeline, true)],
          ['Outstanding', inr(metrics.outstanding, true)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className="num mt-1 text-[16px] font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div className="scroll-thin mt-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const counts = { Leads: records.leads.length, Projects: records.projects.length, Tasks: records.tasks.length, SEO: records.seo.length, Social: records.social.length, Payments: records.payments.length, Notes: records.notes.length };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative shrink-0 px-3 pb-2.5 pt-1 text-[12.5px] transition ${tab === t ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t}
              {counts[t] ? <span className="ml-1 text-[10px] text-muted-foreground/70">{counts[t]}</span> : null}
              {tab === t && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === 'Overview' && (
          <CompanyOverview
            company={company}
            metrics={metrics}
            upcoming={upcoming}
            commercialAgreement={records.agreements.find((agreement) => agreement.seed_key?.startsWith('master-tracking-terms-'))}
            socialProfiles={records.profiles}
          />
        )}
        {tab === 'Website' && <CompanyWebsite company={company} />}

        {tab === 'Leads' && (
          <CompanyRecordList title="Leads" count={records.leads.length} onAdd={() => setEditor({ type: 'lead' })} addLabel="Add lead">
            {records.leads.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">No leads for this company yet.</p> : records.leads.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{l.name} {l.company_name && <span className="font-normal text-muted-foreground">· {l.company_name}</span>}</p>
                  <p className="text-[10.5px] text-muted-foreground">{l.source} · {l.service || 'No requirement noted'}</p>
                </div>
                <span className="num hidden w-20 text-right text-[12px] sm:block">{inr(l.estimated_value, true)}</span>
                <span className="hidden w-24 text-right text-[10.5px] text-muted-foreground md:block">{relative(l.next_follow_up)}</span>
                <StatusBadge status={l.status} />
                {editBtn('lead', l)}
                <DeleteButton onConfirm={() => remove('Lead', l)} label="lead" />
              </div>
            ))}
          </CompanyRecordList>
        )}

        {tab === 'Projects' && (
          <CompanyRecordList title="Projects" count={records.projects.length} onAdd={() => setEditor({ type: 'project' })} addLabel="New project">
            {records.projects.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">No projects yet.</p> : records.projects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${p.id}`} className="truncate text-[12.5px] font-medium hover:underline">{p.name}</Link>
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar value={p.progress} className="max-w-[120px]" />
                    <span className="text-[10px] text-muted-foreground">{p.progress || 0}%</span>
                  </div>
                </div>
                <span className="hidden text-[10.5px] text-muted-foreground sm:block">due {fmtDate(p.deadline, { year: false })}</span>
                <StatusBadge status={p.status} />
                {editBtn('project', p)}
                <DeleteButton onConfirm={() => remove('Project', p)} label="project" />
              </div>
            ))}
          </CompanyRecordList>
        )}

        {tab === 'Tasks' && (
          <CompanyRecordList title="Tasks" count={records.tasks.length} onAdd={() => setEditor({ type: 'task' })} addLabel="Add task">
            {records.tasks.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">No tasks yet.</p> : records.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <button onClick={() => toggleTask(t)} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${t.status === 'Done' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}>
                  {t.status === 'Done' && <Check className="h-2.5 w-2.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12.5px] ${t.status === 'Done' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
                  <p className="text-[10.5px] text-muted-foreground">{t.category} · {t.due_date ? relative(t.due_date) : 'No date'}</p>
                </div>
                <StatusBadge status={t.status} />
                {editBtn('task', t)}
                <DeleteButton onConfirm={() => remove('Task', t)} label="task" />
              </div>
            ))}
          </CompanyRecordList>
        )}

        {tab === 'SEO' && (
          <CompanyRecordList title="SEO tasks" count={records.seo.length} onAdd={() => setEditor({ type: 'seo' })} addLabel="Add SEO task">
            {records.seo.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">No SEO work logged yet.</p> : records.seo.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px]">{s.title}</p>
                  <p className="text-[10.5px] text-muted-foreground">{s.type} · {s.target_page || 'No target page'} {s.keyword ? `· ${s.keyword}` : ''}</p>
                </div>
                <span className="hidden text-[10.5px] text-muted-foreground sm:block">{relative(s.due_date)}</span>
                <StatusBadge status={s.status} />
                {editBtn('seo', s)}
                <DeleteButton onConfirm={() => remove('SeoTask', s)} label="SEO task" />
              </div>
            ))}
          </CompanyRecordList>
        )}

        {tab === 'Social' && (
          <CompanyRecordList title="Content plan" count={records.social.length} onAdd={() => setEditor({ type: 'social' })} addLabel="Plan a post">
            {records.social.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">No content planned yet.</p> : records.social.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px]">{s.title}</p>
                  <p className="text-[10.5px] text-muted-foreground">{s.platform} · {s.post_type} · {fmtDate(s.scheduled_date, { year: false })}</p>
                </div>
                <StatusBadge status={s.status} />
                {editBtn('social', s)}
                <DeleteButton onConfirm={() => remove('SocialPost', s)} label="post" />
              </div>
            ))}
          </CompanyRecordList>
        )}

        {tab === 'Payments' && (
          <CompanyRecordList title="Invoices" count={records.payments.length} onAdd={() => setEditor({ type: 'payment' })} addLabel="Create invoice">
            {records.payments.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">No invoices yet.</p> : records.payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px]">{p.invoice_no || 'No invoice no.'} <span className="text-muted-foreground">· {p.title}</span></p>
                  <p className="text-[10.5px] text-muted-foreground">Due {fmtDate(p.due_date, { year: false })} {p.pending_reason ? `· ${p.pending_reason}` : ''}</p>
                </div>
                <span className="num hidden text-right text-[12px] sm:block">{inr(balanceDue(p))}</span>
                <StatusBadge status={p.status} />
                {editBtn('payment', p)}
                <DeleteButton onConfirm={() => remove('Payment', p)} label="invoice" />
              </div>
            ))}
          </CompanyRecordList>
        )}

        {tab === 'Notes' && (
          <div>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setEditor({ type: 'note' })} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px]"><Plus className="h-3.5 w-3.5" /> Add note</button>
            </div>
            {records.notes.length === 0 ? (
              <EmptyState icon={Pencil} title="No notes yet" description="Keep agreements, preferences and reminders next to the client." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {records.notes.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium">{n.title}</p>
                      <div className="flex items-center gap-1">
                        {editBtn('note', n)}
                        <DeleteButton onConfirm={() => remove('Note', n)} label="note" />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-6 whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CompanyForm open={companyForm} onOpenChange={setCompanyForm} company={company} onSaved={load} />
      <LeadForm open={editor?.type === 'lead'} onOpenChange={(v) => !v && setEditor(null)} companies={companyOption} companyId={company.id} lead={editor?.record} onSaved={load} />
      <ProjectForm open={editor?.type === 'project'} onOpenChange={(v) => !v && setEditor(null)} companies={companyOption} companyId={company.id} project={editor?.record} onSaved={load} />
      <TaskForm open={editor?.type === 'task'} onOpenChange={(v) => !v && setEditor(null)} companies={companyOption} projects={records.projects} companyId={company.id} projectId="" task={editor?.record} onSaved={load} />
      <SeoTaskForm open={editor?.type === 'seo'} onOpenChange={(v) => !v && setEditor(null)} companies={companyOption} companyId={company.id} task={editor?.record} onSaved={load} />
      <SocialPostForm open={editor?.type === 'social'} onOpenChange={(v) => !v && setEditor(null)} companies={companyOption} companyId={company.id} post={editor?.record} onSaved={load} />
      <PaymentForm open={editor?.type === 'payment'} onOpenChange={(v) => !v && setEditor(null)} companies={companyOption} companyId={company.id} payment={editor?.record} onSaved={load} />
      <NoteForm open={editor?.type === 'note'} onOpenChange={(v) => !v && setEditor(null)} companies={companyOption} companyId={company.id} note={editor?.record} onSaved={load} />
    </div>
  );
}