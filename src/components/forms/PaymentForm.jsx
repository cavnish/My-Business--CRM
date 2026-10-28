import React, { useEffect, useState } from 'react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { PAYMENT_KINDS } from '@/lib/constants';
import { monthKey, todayISO } from '@/lib/format';

const blank = {
  company_id: '', invoice_no: '', title: '', kind: 'Monthly service fee', period: monthKey(),
  amount: '', tax_rate: '', discount: 0, amount_received: 0, status: 'Pending', invoice_date: todayISO(),
  due_date: '', payment_date: '', method: '', pending_reason: '', next_reminder: '',
  last_follow_up: '', expected_payment_date: '', notes: '',
};

export default function PaymentForm({ open, onOpenChange, companies = [], companyId, payment, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(payment ? { ...blank, ...payment } : { ...blank, company_id: companyId || companies[0]?.id || '' });
  }, [open, payment, companyId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.company_id) return;
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount) || 0,
      tax_rate: form.tax_rate === '' || form.tax_rate === null ? null : Number(form.tax_rate),
      discount: Number(form.discount) || 0,
      amount_received: Number(payment?.amount_received) || 0,
      invoice_date: form.invoice_date || null,
      due_date: form.due_date || null,
      next_reminder: form.next_reminder || null,
      last_follow_up: form.last_follow_up || null,
      expected_payment_date: form.expected_payment_date || null,
      payment_date: payment?.payment_date || null,
      method: payment?.method || null,
      status: payment?.status || 'Pending',
    };
    try {
      if (payment) await neon.entities.Payment.update(payment.id, payload);
      else await neon.entities.Payment.create(payload);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not save invoice', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{payment ? 'Edit invoice' : 'Create invoice'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company"><SelectInput value={form.company_id} onChange={(v) => set('company_id', v)} options={companies.map((c) => ({ value: c.id, label: c.name }))} allowEmpty={false} /></Field>
          <Field label="Invoice number"><Input value={form.invoice_no} onChange={(e) => set('invoice_no', e.target.value)} placeholder="INV-2627-001" /></Field>
          <Field label="Description" className="sm:col-span-2"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Type"><SelectInput value={form.kind} onChange={(v) => set('kind', v)} options={PAYMENT_KINDS} allowEmpty={false} /></Field>
          <Field label="Billing period"><Input type="month" value={form.period || ''} onChange={(e) => set('period', e.target.value)} /></Field>
          <Field label="Base amount (₹)"><Input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="Tax rate (%)"><Input type="number" value={form.tax_rate ?? ''} onChange={(e) => set('tax_rate', e.target.value)} /></Field>
          <Field label="Discount (₹)"><Input type="number" value={form.discount} onChange={(e) => set('discount', e.target.value)} /></Field>
          <Field label="Invoice status">
            <p className="flex h-9 items-center rounded-lg border border-border bg-muted/40 px-2.5 text-[12px] text-muted-foreground">
              {payment?.status || 'Pending'} — record receipts separately
            </p>
          </Field>
          <Field label="Invoice date"><Input type="date" value={form.invoice_date || ''} onChange={(e) => set('invoice_date', e.target.value)} /></Field>
          <Field label="Due date"><Input type="date" value={form.due_date || ''} onChange={(e) => set('due_date', e.target.value)} /></Field>
          <Field label="Next reminder"><Input type="date" value={form.next_reminder || ''} onChange={(e) => set('next_reminder', e.target.value)} /></Field>
          <Field label="Reason pending" className="sm:col-span-2"><Input value={form.pending_reason} onChange={(e) => set('pending_reason', e.target.value)} placeholder="What is holding this payment up?" /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.company_id}>{saving ? 'Saving…' : payment ? 'Save invoice' : 'Create invoice'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}