import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Check, Plus, FolderKanban } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import DeleteButton from '@/components/shared/DeleteButton';
import ProjectForm from '@/components/forms/ProjectForm';
import TaskForm from '@/components/forms/TaskForm';
import { ProgressBar } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { balanceDue, fmtDate, inr, isOpenInvoice, relative, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [company, setCompany] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectForm, setProjectForm] = useState(false);
  const [taskForm, setTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [progressInput, setProgressInput] = useState(null);
  const persistedProgress = useRef(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const p = await neon.entities.Project.get(id);
      setProject(p);
      persistedProgress.current = Number(p.progress) || 0;
      setProgressInput(null);
      const [c, taskRes, payRes, memberRes] = await Promise.all([
        p.company_id ? neon.entities.Company.get(p.company_id) : Promise.resolve(null),
        neon.entities.Task.filter({ project_id: id }, { sort: 'due_date', limit: 200 }),
        isAdmin && p.company_id ? neon.entities.Payment.filter({ company_id: p.company_id }, { limit: 100 }) : Promise.resolve({ items: [] }),
        isAdmin ? neon.entities.WorkspaceMember.filter({ approval_status: 'approved', role: 'team_member' }, { limit: 200 }) : Promise.resolve({ items: [] }),
      ]);
      setCompany(c);
      setTasks(taskRes.items || []);
      setPayments(payRes.items || []);
      setMembers(memberRes.items || []);
    } catch (error) {
      setProject(null);
      toast({ title: 'Could not load project', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, isAdmin]);

  const toggleTask = async (task, memberStatus) => {
    try {
      await neon.entities.Task.update(task.id, isAdmin
        ? { status: task.status === 'Done' ? 'To Do' : 'Done', completed_date: task.status === 'Done' ? null : todayISO() }
        : { status: memberStatus || 'Awaiting Approval' });
      await load();
    } catch (error) {
      toast({ title: 'Could not update task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const setProgress = async (value) => {
    const progress = Number(value);
    try {
      await neon.entities.Project.update(id, { progress });
      persistedProgress.current = progress;
      setProject((prev) => ({ ...prev, progress }));
      setProgressInput(null);
    } catch (error) {
      setProgressInput(null);
      setProject((prev) => ({ ...prev, progress: persistedProgress.current }));
      toast({ title: 'Could not update project progress', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  if (loading) return <div className="h-72 animate-pulse rounded-2xl border border-border bg-card/60" />;
  if (!project) return <EmptyState icon={FolderKanban} title="Project not found" description="This project is unavailable or not assigned to your account." action={<Link to="/projects" className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">All projects</Link>} />;

  const done = tasks.filter((t) => t.status === 'Done').length;
  const openBills = payments.filter(isOpenInvoice);
  const outstanding = openBills.reduce((s, p) => s + balanceDue(p), 0);

  return (
    <div className="fade-up">
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> All projects</Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[28px] leading-tight sm:text-[34px]">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {company ? (isAdmin ? <Link to={`/companies/${company.id}`} className="hover:text-foreground hover:underline">{company.name}</Link> : company.name) : 'Internal project'}
            {project.deadline && <> · due {fmtDate(project.deadline)} ({relative(project.deadline)})</>}
          </p>
        </div>
        {isAdmin && <button onClick={() => setProjectForm(true)} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 py-2 text-[12px]"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[13px] font-medium">Brief</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{project.description || 'No description yet.'}</p>
            {project.notes && (
              <div className="mt-3 rounded-xl bg-muted/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed">{project.notes}</p>
              </div>
            )}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Completion</span>
                <span className="num font-medium">{progressInput ?? project.progress ?? 0}%</span>
              </div>
              <ProgressBar value={progressInput ?? project.progress} className="h-2" />
              {isAdmin && <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressInput ?? project.progress ?? 0}
                onChange={(e) => setProgressInput(Number(e.target.value))}
                onPointerUp={(e) => setProgress(e.currentTarget.value)}
                onKeyUp={(e) => setProgress(e.currentTarget.value)}
                className="mt-3 w-full accent-[#1F4D3D]"
              />}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div>
                <h2 className="text-[13px] font-medium">Tasks <span className="ml-1 text-[11px] font-normal text-muted-foreground">{done}/{tasks.length} done</span></h2>
              </div>
              {isAdmin && <button onClick={() => { setEditingTask(null); setTaskForm(true); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" /> Add task</button>}
            </div>
            <div className="divide-y divide-border/70">
              {tasks.length === 0 && <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">No tasks linked to this project yet.</p>}
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  {isAdmin ? <button onClick={() => toggleTask(t)} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${t.status === 'Done' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}>
                    {t.status === 'Done' && <Check className="h-2.5 w-2.5" />}
                  </button> : <select
                    aria-label={`Update status for ${t.title}`}
                    value={t.status}
                    disabled={t.status === 'Done' || t.status === 'Awaiting Approval'}
                    onChange={(event) => toggleTask(t, event.target.value)}
                    className="h-8 max-w-36 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {['To Do', 'In Progress', 'Blocked', 'Awaiting Approval'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>}
                  {isAdmin ? <button onClick={() => { setEditingTask(t); setTaskForm(true); }} className="min-w-0 flex-1 text-left"> 
                    <p className={`truncate text-[12.5px] ${t.status === 'Done' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
                    <p className="text-[10.5px] text-muted-foreground">{t.category} · {t.due_date ? relative(t.due_date) : 'No date'}</p>
                  </button> : <div className="min-w-0 flex-1">
                    <p className={`truncate text-[12.5px] ${t.status === 'Done' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
                    <p className="text-[10.5px] text-muted-foreground">{t.category} · {t.due_date ? relative(t.due_date) : 'No date'}</p>
                  </div>}
                  <StatusBadge status={t.status} />
                  {isAdmin && <DeleteButton onConfirm={async () => { await neon.entities.Task.delete(t.id); load(); }} label="task" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {isAdmin && <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[13px] font-medium">Commercials</h2>
            <div className="mt-3 space-y-2 text-[12px]">
              {[['Agreed fee', project.fee ? inr(project.fee) : '—'], ['Budget', project.budget ? inr(project.budget) : '—'], ['Owner', project.owner || '—'], ['Priority', project.priority], ['Start', fmtDate(project.start_date, { year: false })], ['Deadline', fmtDate(project.deadline, { year: false })]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between"><span className="text-muted-foreground">{k}</span><span className="capitalize">{v}</span></div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[13px] font-medium">Client payments</h2>
            <p className="mt-1 text-[11.5px] text-muted-foreground">{openBills.length} open · {inr(outstanding)} outstanding</p>
            <Link to="/payments" className="mt-3 inline-flex text-[11.5px] text-primary hover:underline">Open receivables →</Link>
          </div>
        </div>}
      </div>

      {isAdmin && <ProjectForm open={projectForm} onOpenChange={setProjectForm} companies={company ? [company] : []} members={members} companyId={project.company_id} project={project} onSaved={load} />}
      {isAdmin && <TaskForm open={taskForm} onOpenChange={(v) => { setTaskForm(v); if (!v) setEditingTask(null); }} companies={company ? [{ id: company.id, name: company.name }] : []} projects={[project]} members={members} companyId={project.company_id} projectId={project.id} task={editingTask} onSaved={load} />}
    </div>
  );
}