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
import DeleteButton from '@/components/shared/DeleteButton';

export default function EventForm({ open, onOpenChange, companies = [], event, initialDate, onSaved, isAdmin = false }) {
  const [form, setForm] = useState({ title: '', date: todayISO(), category: 'Custom event', region: 'India', company_id: '', description: '', verification_status: 'Manual', greeting_suitable: false, source_url: '', source_attribution: '', person_name: '', location: '', religion: '', historical_year: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(event ? { ...event } : { title: '', date: initialDate || todayISO(), category: 'Custom event', region: 'India', company_id: '', description: '', verification_status: 'Manual', greeting_suitable: false, source_url: '', source_attribution: '', person_name: '', location: '', religion: '', historical_year: '' });
  }, [open, event, initialDate]);

  const save = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: form.company_id || null,
        historical_year: form.historical_year === '' || form.historical_year === null ? null : Number(form.historical_year),
        source_url: form.source_url || null,
        source_attribution: form.source_attribution || null,
        person_name: form.person_name || null,
        location: form.location || null,
        religion: form.religion || null,
      };
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
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
          {isAdmin && <>
            <Field label="Verification"><SelectInput value={form.verification_status || 'Manual'} onChange={(v) => setForm((f) => ({ ...f, verification_status: v }))} options={['Manual', 'Verified', 'Curated', 'Approximate', 'Tentative']} allowEmpty={false} /></Field>
            <Field label="Historical year"><Input type="number" value={form.historical_year ?? ''} onChange={(e) => setForm((f) => ({ ...f, historical_year: e.target.value }))} /></Field>
            <Field label="Person"><Input value={form.person_name || ''} onChange={(e) => setForm((f) => ({ ...f, person_name: e.target.value }))} /></Field>
            <Field label="Location"><Input value={form.location || ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></Field>
            <Field label="Religion / tradition"><Input value={form.religion || ''} onChange={(e) => setForm((f) => ({ ...f, religion: e.target.value }))} /></Field>
            <Field label="Source URL"><Input type="url" value={form.source_url || ''} onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))} /></Field>
            <Field label="Source attribution" className="sm:col-span-2"><Input value={form.source_attribution || ''} onChange={(e) => setForm((f) => ({ ...f, source_attribution: e.target.value }))} /></Field>
            <label className="flex items-center gap-2 text-[12px] sm:col-span-2"><input type="checkbox" checked={Boolean(form.greeting_suitable)} onChange={(e) => setForm((f) => ({ ...f, greeting_suitable: e.target.checked }))} className="accent-primary" />Suitable for company greeting preparation</label>
          </>}
        </div>
        <DialogFooter>
          {event && (
            <DeleteButton
              label="event"
              size="sm"
              onConfirm={async () => {
                if (event.source && event.source !== 'manual') {
                  await neon.entities.CalendarEvent.update(event.id, { status: 'Cancelled' });
                } else {
                  await neon.entities.CalendarEvent.delete(event.id);
                }
                onOpenChange(false);
                onSaved?.();
              }}
            />
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : event ? 'Save event' : 'Add event'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
