import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, CheckSquare, LayoutGrid, List, CornerDownLeft } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import TaskRow from '@/components/tasks/TaskRow';
import TaskForm from '@/components/forms/TaskForm';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/components/ui/use-toast';
import useNewQuery from '@/hooks/useNewQuery';
import { TASK_CATEGORIES, TASK_STATUS } from '@/lib/constants';
import { addDays, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';

const VIEWS = ['Today', 'Tomorrow', 'This week', 'Overdue', 'Upcoming', 'Completed', 'All'];

export default function Tasks() {
  const today = todayISO();
  const [tasks, setTasks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('Today');
  const [layout, setLayout] = useState('list');
  const [companyId, setCompanyId] = useState('all');
  const [category, setCategory] = useState('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [formOpen, setFormOpen] = useNewQuery();
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [members, setMembers] = useState([]);

  const load = async () => {
    try {
      const [taskRes, companyRes, projectRes, memberRes] = await Promise.all([
        neon.entities.Task.filter({}, { sort: 'due_date', limit: 500 }),
        neon.entities.Company.list({ limit: 60 }),
        neon.entities.Project.filter({}, { limit: 200 }),
        isAdmin ? neon.entities.WorkspaceMember.filter({ approval_status: 'approved', role: 'team_member' }, { limit: 200 }) : Promise.resolve({ items: [] }),
      ]);
      setTasks(taskRes.items || []);
      setCompanies(companyRes.items || []);
      setProjects(projectRes.items || []);
      setMembers(memberRes.items || []);
    } catch (error) {
      toast({ title: 'Could not load tasks', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isAdmin]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const scoped = tasks.filter((t) => (companyId === 'all' || t.company_id === companyId) && (category === 'all' || t.category === category));

  const filtered = scoped.filter((t) => {
    const due = String(t.due_date || '').slice(0, 10);
    if (view === 'Today') return due === today && t.status !== 'Done';
    if (view === 'Tomorrow') return due === addDays(1) && t.status !== 'Done';
    if (view === 'This week') return due >= today && due <= addDays(7) && t.status !== 'Done';
    if (view === 'Overdue') return due && due < today && t.status !== 'Done';
    if (view === 'Upcoming') return due > today && t.status !== 'Done';
    if (view === 'Completed') return t.status === 'Done';
    return true;
  }).sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));

  const counts = {
    Today: scoped.filter((t) => String(t.due_date).slice(0, 10) === today && t.status !== 'Done').length,
    Tomorrow: scoped.filter((t) => String(t.due_date).slice(0, 10) === addDays(1) && t.status !== 'Done').length,
    'This week': scoped.filter((t) => String(t.due_date).slice(0, 10) >= today && String(t.due_date).slice(0, 10) <= addDays(7) && t.status !== 'Done').length,
    Overdue: scoped.filter((t) => t.due_date && String(t.due_date).slice(0, 10) < today && t.status !== 'Done').length,
    Upcoming: scoped.filter((t) => String(t.due_date).slice(0, 10) > today && t.status !== 'Done').length,
    Completed: scoped.filter((t) => t.status === 'Done').length,
    All: scoped.length,
  };

  const toggle = async (task) => {
    const done = task.status === 'Done';
    const nextStatus = isAdmin ? (done ? 'To Do' : 'Done') : 'Awaiting Approval';
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus, completed_date: isAdmin && !done ? today : null } : t)));
    try {
      await neon.entities.Task.update(task.id, { status: nextStatus, ...(isAdmin ? { completed_date: done ? null : today } : {}) });
    } catch (error) {
      setTasks(previous);
      toast({ title: 'Could not update task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const remove = async (task) => {
    try {
      await neon.entities.Task.delete(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (error) {
      toast({ title: 'Could not delete task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const quickAdd = async () => {
    if (!quickTitle.trim()) return;
    const payload = {
      title: quickTitle.trim(),
      company_id: companyId !== 'all' ? companyId : null,
      category: category !== 'all' ? category : 'Administration',
      due_date: view === 'Tomorrow' ? addDays(1) : today,
      status: 'To Do',
      priority: 'Medium',
    };
    try {
      const created = await neon.entities.Task.create(payload);
      setTasks((prev) => [...prev, created]);
      setQuickTitle('');
    } catch (error) {
      toast({ title: 'Could not add task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const moveTask = async (task, status) => {
    if (!isAdmin && status === 'Done') status = 'Awaiting Approval';
    const patch = isAdmin
      ? (status === 'Done' ? { status, completed_date: today } : { status, completed_date: null })
      : { status };
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    try {
      await neon.entities.Task.update(task.id, patch);
    } catch (error) {
      setTasks(previous);
      toast({ title: 'Could not update task', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const moveTask2 = (result) => {
    if (!result.destination) return;
    const task = tasks.find((t) => t.id === result.draggableId);
    if (!task || task.status === result.destination.droppableId) return;
    moveTask(task, result.destination.droppableId);
  };

  const openEdit = (task) => { setEditing(task); setFormOpen(true); };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Daily work"
        title="Tasks"
        description="Everything you owe a client, ordered by when it needs you."
        actions={isAdmin && <button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Add task</button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {VIEWS.map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${view === v ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
            {v}{counts[v] > 0 && <span className="ml-1 opacity-70">{counts[v]}</span>}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-2 text-[11.5px]">
            <option value="all">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="hidden h-8 rounded-lg border border-input bg-card px-2 text-[11.5px] sm:block">
            <option value="all">All categories</option>
            {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {isAdmin && <div className="flex rounded-lg border border-border bg-card p-0.5">
            <button onClick={() => setLayout('list')} className={`rounded-md p-1.5 ${layout === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><List className="h-3.5 w-3.5" /></button>
            <button onClick={() => setLayout('board')} className={`rounded-md p-1.5 ${layout === 'board' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="h-3.5 w-3.5" /></button>
          </div>}
        </div>
      </div>

      {isAdmin && <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); }}
          placeholder={`Quick add a task${view === 'Tomorrow' ? ' for tomorrow' : ' for today'}…`}
          className="h-6 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/70"
        />
        <button onClick={quickAdd} disabled={!quickTitle.trim()} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10.5px] text-muted-foreground disabled:opacity-50">
          <CornerDownLeft className="h-2.5 w-2.5" /> Add
        </button>
      </div>}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card/60" />
      ) : layout === 'board' ? (
        <DragDropContext onDragEnd={moveTask2}>
          <div className="scroll-thin flex gap-2.5 overflow-x-auto pb-3">
            {TASK_STATUS.map((status) => {
              const column = filtered.filter((t) => t.status === status);
              return (
                <div key={status} className="w-[250px] shrink-0 rounded-2xl border border-border bg-[#F6F3EC]/70">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-[11.5px] font-medium">{status}</span>
                    <span className="rounded-full bg-card px-1.5 text-[10px] text-muted-foreground">{column.length}</span>
                  </div>
                  <Droppable droppableId={status}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-[100px] space-y-2 px-2 pb-2 ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}>
                        {column.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(dragProvided) => (
                              <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} onClick={() => openEdit(task)} className="rounded-xl border border-border bg-card p-3">
                                <p className="text-[12px] leading-snug">{task.title}</p>
                                <p className="mt-1 truncate text-[10.5px] text-muted-foreground">{companiesById[task.company_id]?.name || 'Internal'} · {task.category}</p>
                                <div className="mt-2 flex items-center justify-between">
                                  <StatusBadge status={task.status} dot={false} />
                                  <span className={`text-[10px] ${task.status !== 'Done' && task.due_date && String(task.due_date).slice(0, 10) < today ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                                    {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Nothing here" description="This view is clear. Add a task or switch to another view." action={null} />
      ) : (
        <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} companyName={companiesById[task.company_id]?.name} onToggle={toggle} onEdit={openEdit} onDelete={remove} onStatusChange={moveTask} canManage={isAdmin} />
          ))}
        </div>
      )}

      {isAdmin && <TaskForm open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }} companies={companies} projects={projects} members={members} companyId={companyId !== 'all' ? companyId : ''} projectId="" task={editing} onSaved={load} />}
    </div>
  );
}