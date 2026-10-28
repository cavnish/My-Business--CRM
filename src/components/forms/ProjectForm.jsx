import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { PRIORITIES, PROJECT_STATUS } from '@/lib/constants';

const blank = {
  company_id: '', name: '', description: '', status: 'Planned', priority: 'Medium',
  start_date: '', deadline: '', owner: '', budget: '', fee: '', progress: 0, notes: '',
};

export default function ProjectForm({ open, onOpenChange, companies = [], members = [], companyId, project, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(project ? { ...blank, ...project } : { ...blank, company_id: companyId || companies[0]?.id || '' });
  }, [open, project, companyId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.company_id) return;
    setSaving(true);
    const payload = {
      ...form,
      budget: Number(form.budget) || 0,
      fee: Number(form.fee) || 0,
      progress: Number(form.progress) || 0,
      assignee_id: form.assignee_id || null,
      start_date: form.start_date || null,
      deadline: form.deadline || null,
    };
    try {
      if (project) await neon.entities.Project.update(project.id, payload);
      else await neon.entities.Project.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save project', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{project ? 'Edit project' : 'Start a project'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company"><SelectInput value={form.company_id} onChange={(v) => set('company_id', v)} options={companies.map((c) => ({ value: c.id, label: c.name }))} allowEmpty={false} /></Field>
          <Field label="Status"><SelectInput value={form.status} onChange={(v) => set('status', v)} options={PROJECT_STATUS} allowEmpty={false} /></Field>
          <Field label="Project name" className="sm:col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Priority"><SelectInput value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} allowEmpty={false} /></Field>
          <Field label="Owner"><Input value={form.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
          <Field label="Assigned team member"><SelectInput value={form.assignee_id || ''} onChange={(v) => set('assignee_id', v)} options={members.map((member) => ({ value: member.user_id, label: member.full_name || member.email }))} placeholder="Unassigned" /></Field>
          <Field label="Start date"><Input type="date" value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="Deadline"><Input type="date" value={form.deadline || ''} onChange={(e) => set('deadline', e.target.value)} /></Field>
          <Field label="Agreed fee (₹)"><Input type="number" value={form.fee} onChange={(e) => set('fee', e.target.value)} /></Field>
          <Field label="Budget (₹)"><Input type="number" value={form.budget} onChange={(e) => set('budget', e.target.value)} /></Field>
          <Field label="Progress (%)" className="sm:col-span-2">
            <input type="range" min="0" max="100" step="5" value={form.progress || 0} onChange={(e) => set('progress', e.target.value)} className="w-full accent-[#1F4D3D]" />
            <span className="mt-1 block text-[11px] text-muted-foreground">{form.progress || 0}% complete</span>
          </Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim() || !form.company_id}>{saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}