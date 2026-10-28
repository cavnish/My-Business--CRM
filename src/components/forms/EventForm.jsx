import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { EVENT_CATEGORIES } from '@/lib/constants';
import { todayISO } from '@/lib/format';

export default function EventForm({ open, onOpenChange, companies = [], event, initialDate, onSaved }) {
  const [form, setForm] = useState({ title: '', date: todayISO(), category: 'Custom event', region: 'India', company_id: '', description: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(event ? { ...event } : { title: '', date: initialDate || todayISO(), category: 'Custom event', region: 'India', company_id: '', description: '' });
  }, [open, event, initialDate]);

  const save = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const payload = { ...form, company_id: form.company_id || null };
      if (event) await neon.entities.CalendarEvent.update(event.id, payload);
      else await neon.entities.CalendarEvent.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save event', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{event ? 'Edit event' : 'Add calendar event'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event" className="sm:col-span-2"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Date"><Input type="date" value={form.date || ''} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
          <Field label="Category"><SelectInput value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={EVENT_CATEGORIES} allowEmpty={false} /></Field>
          <Field label="Region"><Input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} /></Field>
          <Field label="Company">
            <SelectInput value={form.company_id || ''} onChange={(v) => setForm((f) => ({ ...f, company_id: v }))} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="All companies" />
          </Field>
          <Field label="Description" className="sm:col-span-2"><Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : event ? 'Save event' : 'Add event'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}