import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { LEAD_SOURCES, LEAD_STAGES, PRIORITIES } from '@/lib/constants';

const blank = {
  company_id: '', name: '', company_name: '', phone: '', email: '', location: '', source: 'Manual entry',
  service: '', estimated_value: '', status: 'New Lead', priority: 'Medium', owner: '',
  next_follow_up: '', expected_close: '', notes: '', lost_reason: '',
};

export default function LeadForm({ open, onOpenChange, companies = [], companyId, lead, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(lead ? { ...blank, ...lead } : { ...blank, company_id: companyId || companies[0]?.id || '' });
  }, [open, lead, companyId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.company_id) return;
    setSaving(true);
    const payload = {
      ...form,
      estimated_value: Number(form.estimated_value) || 0,
      next_follow_up: form.next_follow_up || null,
      expected_close: form.expected_close || null,
    };
    try {
      if (lead) await neon.entities.Lead.update(lead.id, payload);
      else await neon.entities.Lead.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({
        title: 'Could not save lead',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{lead ? 'Edit lead' : 'Add a lead'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company"><SelectInput value={form.company_id} onChange={(v) => set('company_id', v)} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose a company" allowEmpty={false} /></Field>
          <Field label="Lead name"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Contact person" /></Field>
          <Field label="Their company"><Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Source"><SelectInput value={form.source} onChange={(v) => set('source', v)} options={LEAD_SOURCES} allowEmpty={false} /></Field>
          <Field label="Stage"><SelectInput value={form.status} onChange={(v) => set('status', v)} options={LEAD_STAGES} allowEmpty={false} /></Field>
          <Field label="Priority"><SelectInput value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} allowEmpty={false} /></Field>
          <Field label="Estimated value (₹)"><Input type="number" value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)} /></Field>
          <Field label="Requirement"><Input value={form.service} onChange={(e) => set('service', e.target.value)} placeholder="Product or service requested" /></Field>
          <Field label="Next follow-up"><Input type="date" value={form.next_follow_up || ''} onChange={(e) => set('next_follow_up', e.target.value)} /></Field>
          <Field label="Expected close"><Input type="date" value={form.expected_close || ''} onChange={(e) => set('expected_close', e.target.value)} /></Field>
          {form.status === 'Lost' && (
            <Field label="Reason lost"><Input value={form.lost_reason} onChange={(e) => set('lost_reason', e.target.value)} /></Field>
          )}
          <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim() || !form.company_id}>{saving ? 'Saving…' : lead ? 'Save changes' : 'Add lead'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}