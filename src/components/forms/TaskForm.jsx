import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { PRIORITIES, TASK_CATEGORIES, TASK_STATUS } from '@/lib/constants';
import { todayISO } from '@/lib/format';

const blank = {
  company_id: '', project_id: '', title: '', description: '', category: 'Administration',
  priority: 'Medium', status: 'To Do', due_date: '', start_date: '', assigned_to: '',
  estimate_hours: '', notes: '', completed_date: '', subtasks: [],
};

export default function TaskForm({ open, onOpenChange, companies = [], projects = [], members = [], companyId, projectId, task, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(task ? { ...blank, ...task } : {
        ...blank,
        company_id: companyId || companies[0]?.id || '',
        project_id: projectId || '',
        due_date: todayISO(),
      });
      setSubtaskTitle('');
    }
  }, [open, task, companyId, projectId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const companyProjects = projects.filter((p) => p.company_id === form.company_id);
  const subtasks = Array.isArray(form.subtasks) ? form.subtasks : [];

  const addSubtask = () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    const id = globalThis.crypto?.randomUUID?.() || `subtask-${Date.now()}`;
    set('subtasks', [...subtasks, { id, title, completed: false }]);
    setSubtaskTitle('');
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      company_id: form.company_id || null,
      project_id: form.project_id || null,
      assignee_id: form.assignee_id || null,
      subtasks,
      estimate_hours: Number(form.estimate_hours) || 0,
      due_date: form.due_date || null,
      start_date: form.start_date || null,
      completed_date: form.status === 'Done' ? (form.completed_date || todayISO()) : null,
    };
    try {
      if (task) await neon.entities.Task.update(task.id, payload);
      else await neon.entities.Task.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save task', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{task ? 'Edit task' : 'Add a task'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Task" className="sm:col-span-2"><Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs to be done?" /></Field>
          <Field label="Company"><SelectInput value={form.company_id} onChange={(v) => { set('company_id', v); set('project_id', ''); }} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Internal / no company" /></Field>
          <Field label="Project"><SelectInput value={form.project_id || ''} onChange={(v) => set('project_id', v)} options={companyProjects.map((p) => ({ value: p.id, label: p.name }))} placeholder="No project" /></Field>
          <Field label="Category"><SelectInput value={form.category} onChange={(v) => set('category', v)} options={TASK_CATEGORIES} allowEmpty={false} /></Field>
          <Field label="Status"><SelectInput value={form.status} onChange={(v) => set('status', v)} options={TASK_STATUS} allowEmpty={false} /></Field>
          <Field label="Priority"><SelectInput value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} allowEmpty={false} /></Field>
          <Field label="Due date"><Input type="date" value={form.due_date || ''} onChange={(e) => set('due_date', e.target.value)} /></Field>
          <Field label="Assigned to"><Input value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} /></Field>
          <Field label="Team member"><SelectInput value={form.assignee_id || ''} onChange={(v) => set('assignee_id', v)} options={members.map((member) => ({ value: member.user_id, label: member.full_name || member.email }))} placeholder="Unassigned" /></Field>
          <Field label="Estimate (hours)"><Input type="number" step="0.5" value={form.estimate_hours} onChange={(e) => set('estimate_hours', e.target.value)} /></Field>
          <Field label="Details" className="sm:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          <Field label="Subtasks" className="sm:col-span-2">
            <div className="space-y-2">
              {subtasks.map((subtask, index) => (
                <div key={subtask.id || `${subtask.title}-${index}`} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(subtask.completed)}
                    onChange={(event) => set('subtasks', subtasks.map((item, itemIndex) => itemIndex === index ? { ...item, completed: event.target.checked } : item))}
                    aria-label={`Mark ${subtask.title} complete`}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className={`min-w-0 flex-1 text-sm ${subtask.completed ? 'text-muted-foreground line-through' : ''}`}>{subtask.title}</span>
                  <button type="button" aria-label={`Remove ${subtask.title}`} onClick={() => set('subtasks', subtasks.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">×</button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubtask(); } }} placeholder="Add a checklist item" />
                <Button type="button" variant="outline" onClick={addSubtask} disabled={!subtaskTitle.trim()}>Add</Button>
              </div>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}