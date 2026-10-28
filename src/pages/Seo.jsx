import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search as SearchIcon, Info } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import DeleteButton from '@/components/shared/DeleteButton';
import SeoTaskForm from '@/components/forms/SeoTaskForm';
import EmptyState from '@/components/shared/EmptyState';
import useNewQuery from '@/hooks/useNewQuery';
import { monthKey, relative, todayISO } from '@/lib/format';
import { SEO_TYPES } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';

export default function Seo() {
  const [tasks, setTasks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('all');
  const [type, setType] = useState('All');
  const [formOpen, setFormOpen] = useNewQuery();
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    const query = {};
    if (companyId !== 'all') query.company_id = companyId;
    try {
      const [taskRes, companyRes] = await Promise.all([
        neon.entities.SeoTask.filter(query, { sort: 'due_date', limit: 200 }),
        neon.entities.Company.list({ limit: 60 }),
      ]);
      setTasks(taskRes.items || []);
      setCompanies(companyRes.items || []);
    } catch (error) {
      toast({ title: 'Could not load SEO tasks', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const month = monthKey();
  const doneThisMonth = tasks.filter((t) => t.status === 'Done' && String(t.completed_date).slice(0, 7) === month);
  const pending = tasks.filter((t) => t.status !== 'Done');
  const highPriority = pending.filter((t) => t.priority === 'High');
  const visible = tasks.filter((t) => type === 'All' || t.type === type);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Organic growth"
        title="SEO"
        description="A work log for every site: what was audited, what was fixed, and what is still open."
        actions={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Add SEO task</button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Pending work', pending.length],
          ['Completed this month', doneThisMonth.length],
          ['High priority', highPriority.length],
          ['Overdue', pending.filter((t) => t.due_date && String(t.due_date).slice(0, 10) < todayISO()).length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className="num mt-1 text-[17px] font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {['All', ...SEO_TYPES].map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${type === t ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="ml-auto h-8 rounded-lg border border-input bg-card px-2 text-[11.5px]">
          <option value="all">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card/60" />
      ) : visible.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No SEO tasks yet" description="Log a technical fix or an on-page change to keep a record of the work." action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Add SEO task</button>} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border/70">
            {visible.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3 transition hover:bg-muted/20">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${t.priority === 'High' ? 'bg-rose-500' : t.priority === 'Low' ? 'bg-slate-300' : 'bg-amber-400'}`} />
                <button onClick={() => { setEditing(t); setFormOpen(true); }} className="min-w-0 flex-1 text-left">
                  <p className="text-[12.5px] leading-snug">{t.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    <span className="font-medium text-foreground/65">{companiesById[t.company_id]?.name || '—'}</span>
                    <span>·</span><span>{t.type}</span>
                    {t.target_page && <><span>·</span><span className="font-mono text-[10px]">{t.target_page}</span></>}
                    {t.keyword && <><span>·</span><span>{t.keyword}</span></>}
                  </p>
                  {t.issue && <p className="mt-1 line-clamp-1 text-[10.5px] text-muted-foreground/80">{t.issue}</p>}
                </button>
                <span className="hidden w-20 shrink-0 text-right text-[10.5px] text-muted-foreground sm:block">{t.status === 'Done' ? 'Completed' : relative(t.due_date)}</span>
                <StatusBadge status={t.status} />
                <DeleteButton onConfirm={async () => { await neon.entities.SeoTask.delete(t.id); load(); }} label="SEO task" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#E7DCC8] bg-[#FBF7EF] px-4 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A87A44]" />
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Search Console, Analytics and ranking data are not connected yet, so no performance numbers are shown. This workspace records the SEO work itself and links each task to its target page and keyword.
        </p>
      </div>

      <SeoTaskForm open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }} companies={companies} companyId={companyId !== 'all' ? companyId : ''} task={editing} onSaved={load} />
    </div>
  );
}