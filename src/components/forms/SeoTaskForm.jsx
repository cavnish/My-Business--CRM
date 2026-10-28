import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { PRIORITIES, SEO_TYPES } from '@/lib/constants';
import { todayISO } from '@/lib/format';

const blank = {
  company_id: '', title: '', type: 'On-Page', target_page: '', issue: '', priority: 'Medium',
  status: 'Pending', due_date: '', completed_date: '', keyword: '', notes: '',
};

export default function SeoTaskForm({ open, onOpenChange, companies = [], companyId, task, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(task ? { ...blank, ...task } : { ...blank, company_id: companyId || companies[0]?.id || '' });
  }, [open, task, companyId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.company_id) return;
    setSaving(true);
    const payload = {
      ...form,
      due_date: form.due_date || null,
      completed_date: form.status === 'Done' ? (form.completed_date || todayISO()) : null,
    };
    try {
      if (task) await neon.entities.SeoTask.update(task.id, payload);
      else await neon.entities.SeoTask.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save SEO task', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{task ? 'Edit SEO task' : 'Add SEO task'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company"><SelectInput value={form.company_id} onChange={(v) => set('company_id', v)} options={companies.map((c) => ({ value: c.id, label: c.name }))} allowEmpty={false} /></Field>
          <Field label="Type"><SelectInput value={form.type} onChange={(v) => set('type', v)} options={SEO_TYPES} allowEmpty={false} /></Field>
          <Field label="Task" className="sm:col-span-2"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Target page"><Input value={form.target_page} onChange={(e) => set('target_page', e.target.value)} placeholder="/category/page" /></Field>
          <Field label="Target keyword"><Input value={form.keyword} onChange={(e) => set('keyword', e.target.value)} /></Field>
          <Field label="Issue / opportunity" className="sm:col-span-2"><Textarea rows={2} value={form.issue} onChange={(e) => set('issue', e.target.value)} /></Field>
          <Field label="Priority"><SelectInput value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} allowEmpty={false} /></Field>
          <Field label="Status"><SelectInput value={form.status} onChange={(v) => set('status', v)} options={['Pending', 'In Progress', 'Done']} allowEmpty={false} /></Field>
          <Field label="Due date"><Input type="date" value={form.due_date || ''} onChange={(e) => set('due_date', e.target.value)} /></Field>
          <Field label="Resolution notes"><Input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.company_id}>{saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}