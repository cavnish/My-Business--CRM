import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import DeleteButton from '@/components/shared/DeleteButton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { inr } from '@/lib/format';

const blankGoal = { title: '', description: '', target_value: '', current_value: '', due_date: '', status: 'In Progress' };

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState(blankGoal);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const result = await neon.entities.WorkspaceGoal.list({ sort: 'due_date', limit: 200 });
      setGoals(result.items || []);
    } catch (error) {
      toast({ title: 'Could not load goals', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const startCreate = (goal = null) => {
    setEditing(goal);
    setForm(goal ? { ...blankGoal, ...goal } : blankGoal);
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      target_value: Number(form.target_value) || 0,
      current_value: Number(form.current_value) || 0,
      due_date: form.due_date || null,
      status: form.status,
    };
    try {
      if (editing) await neon.entities.WorkspaceGoal.update(editing.id, payload);
      else await neon.entities.WorkspaceGoal.create(payload);
      setOpen(false);
      await load();
    } catch (error) {
      toast({ title: 'Could not save goal', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (goal) => {
    try {
      await neon.entities.WorkspaceGoal.delete(goal.id);
      setGoals((current) => current.filter((item) => item.id !== goal.id));
    } catch (error) {
      toast({ title: 'Could not delete goal', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Planning"
        title="Goals"
        description="Track workspace targets and progress in the same place as project delivery."
        actions={<Button onClick={() => startCreate()}><Plus /> Add goal</Button>}
      />
      {goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Create a workspace goal to track a business target or milestone." action={<Button onClick={() => startCreate()}><Plus /> Create a goal</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const target = Number(goal.target_value || 0);
            const current = Number(goal.current_value || 0);
            const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            return (
              <article key={goal.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <button className="text-left text-sm font-medium hover:text-primary" onClick={() => startCreate(goal)}>{goal.title}</button>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{goal.description || 'No description'}</p>
                  </div>
                  <DeleteButton onConfirm={() => remove(goal)} label="goal" />
                </div>
                <div className="mt-4 flex justify-between text-xs">
                  <span>{target > 0 ? `${inr(current)} / ${inr(target)}` : `${current} progress`}</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                  <span>{goal.status}</span>
                  <span>{goal.due_date ? new Date(`${goal.due_date}T00:00:00`).toLocaleDateString('en-IN') : 'No deadline'}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <form onSubmit={save} className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="font-display text-xl">{editing ? 'Edit goal' : 'Add a goal'}</h2>
          <label className="block text-xs font-medium text-muted-foreground">
            Goal name
            <input autoFocus required value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Description
            <textarea rows={3} value={form.description || ''} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Target
              <input type="number" min="0" step="0.01" value={form.target_value ?? ''} onChange={(event) => setForm((value) => ({ ...value, target_value: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Current progress
              <input type="number" min="0" step="0.01" value={form.current_value ?? ''} onChange={(event) => setForm((value) => ({ ...value, current_value: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Deadline
              <input type="date" value={form.due_date || ''} onChange={(event) => setForm((value) => ({ ...value, due_date: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Status
              <select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option>In Progress</option><option>On Hold</option><option>Completed</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create goal'}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
