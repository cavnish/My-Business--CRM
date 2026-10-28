import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FolderKanban } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import ProjectCard from '@/components/projects/ProjectCard';
import ProjectForm from '@/components/forms/ProjectForm';
import EmptyState from '@/components/shared/EmptyState';
import useNewQuery from '@/hooks/useNewQuery';
import { inr } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';

const FILTERS = ['All', 'In Progress', 'Planned', 'Awaiting Client', 'On Hold', 'Completed'];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filter, setFilter] = useState('All');
  const [companyId, setCompanyId] = useState('all');
  const [formOpen, setFormOpen] = useNewQuery();
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [members, setMembers] = useState([]);

  const load = async () => {
    const query = {};
    if (companyId !== 'all') query.company_id = companyId;
    const [projectRes, companyRes, memberRes] = await Promise.all([
      neon.entities.Project.filter(query, { sort: '-created_date', limit: 200 }),
      neon.entities.Company.list({ limit: 60 }),
      isAdmin ? neon.entities.WorkspaceMember.filter({ approval_status: 'approved', role: 'team_member' }, { limit: 200 }) : Promise.resolve({ items: [] }),
    ]);
    setProjects(projectRes.items || []);
    setCompanies(companyRes.items || []);
    setMembers(memberRes.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId, isAdmin]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const visible = projects.filter((p) => filter === 'All' || p.status === filter);
  const active = projects.filter((p) => ['In Progress', 'Planned', 'Awaiting Client'].includes(p.status));
  const totalFee = active.reduce((s, p) => s + Number(p.fee || 0), 0);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description="Every engagement, its progress and the work still outstanding."
        actions={isAdmin && <button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> New project</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${filter === f ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
              {f} {f === 'All' ? projects.length : projects.filter((p) => p.status === f).length}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">Active value <span className="num font-medium text-foreground">{inr(totalFee)}</span></span>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-2 text-[11.5px]">
            <option value="all">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl border border-border bg-card/60" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects in this view" description={isAdmin ? 'Start a project to track deadlines, tasks and deliverables.' : 'Projects assigned to you will appear here.'} action={isAdmin && <button onClick={() => { setEditing(null); setFormOpen(true); }} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Start a project</button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => <ProjectCard key={p.id} project={p} company={companiesById[p.company_id]} />)}
        </div>
      )}

      {isAdmin && <ProjectForm open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }} companies={companies} members={members} companyId={companyId !== 'all' ? companyId : ''} project={editing} onSaved={load} />}
    </div>
  );
}