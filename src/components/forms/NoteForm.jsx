import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';

export default function NoteForm({ open, onOpenChange, companies = [], companyId, note, onSaved }) {
  const [form, setForm] = useState({ company_id: '', title: '', body: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(note ? { ...note } : { company_id: companyId || '', title: '', body: '', pinned: false });
  }, [open, note, companyId]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, company_id: form.company_id || null };
      if (note) await neon.entities.Note.update(note.id, payload);
      else await neon.entities.Note.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save note', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{note ? 'Edit note' : 'New note'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {companies.length > 0 && (
            <Field label="Company">
              <SelectInput value={form.company_id} onChange={(v) => setForm((f) => ({ ...f, company_id: v }))} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="General note" />
            </Field>
          )}
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Note"><Textarea rows={7} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={!!form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} className="accent-[#1F4D3D]" />
            Pin this note to the top
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : note ? 'Save note' : 'Add note'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}