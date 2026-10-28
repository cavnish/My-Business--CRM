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
import InvoiceLineItemsEditor from '@/components/bills/InvoiceLineItemsEditor';
import { invoiceItemsForPayment, invoiceSubtotal, savedLineItems } from '@/lib/invoiceItems';
import { inr } from '@/lib/format';

const blank = {
  company_id: '', invoice_no: '', title: '', kind: 'Monthly service fee', period: monthKey(),
  amount: '', tax_rate: '', discount: 0, amount_received: 0, status: 'Pending', invoice_date: todayISO(),
  due_date: '', payment_date: '', method: '', pending_reason: '', next_reminder: '',
  last_follow_up: '', expected_payment_date: '', notes: '',
};

export default function PaymentForm({ open, onOpenChange, companies = [], companyId, payment, initialKind, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [lineItems, setLineItems] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(payment ? { ...blank, ...payment } : {
        ...blank,
        company_id: companyId || companies[0]?.id || '',
        kind: initialKind || blank.kind,
        title: initialKind === 'Website one-time fee' ? 'Website one-time fee' : '',
      });
      setLineItems(payment
        ? invoiceItemsForPayment(payment)
        : [{ description: initialKind === 'Website one-time fee' ? 'Website one-time fee' : '', note: '', qty: 1, rate: '' }]);
    }
  }, [open, payment, companyId, initialKind]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.company_id) return;
    const savedItems = savedLineItems(lineItems);
    const invalidInputLine = lineItems.some((item) => (
      !Number.isFinite(Number(item.qty))
      || Number(item.qty) <= 0
      || item.rate === ''
      || item.rate === null
      || item.rate === undefined
      || !Number.isFinite(Number(item.rate))
      || Number(item.rate) < 0
    ));
    if (!savedItems.length || invalidInputLine || savedItems.some((item) => (
      !item.description
      || !Number.isFinite(Number(item.qty))
      || item.qty <= 0
      || !Number.isFinite(Number(item.rate))
      || item.rate < 0
    ))) {
      toast({ title: 'Check the invoice line items', description: 'Each line needs a description, a quantity greater than zero, and an entered non-negative rate.', variant: 'destructive' });
      return;
    }
    const taxRate = form.tax_rate === '' || form.tax_rate === null ? 0 : Number(form.tax_rate);
    const discount = Number(form.discount) || 0;
    if (!Number.isFinite(taxRate) || taxRate < 0 || !Number.isFinite(discount) || discount < 0
      || discount > invoiceSubtotal(savedItems) * (1 + taxRate / 100)) {
      toast({ title: 'Check tax and discount', description: 'Tax and discount must be non-negative, and the discount cannot exceed the invoice total.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      invoice_no: String(form.invoice_no || '').trim() || null,
      title: form.title.trim(),
      line_items: savedItems,
      amount: invoiceSubtotal(savedItems),
      tax_rate: form.tax_rate === '' || form.tax_rate === null ? null : taxRate,
      discount,
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
      if (payload.invoice_no) {
        const duplicate = await neon.entities.Payment.filter({
          company_id: form.company_id,
          invoice_no: payload.invoice_no,
        }, { limit: 1 });
        if (duplicate.items?.some((item) => item.id !== payment?.id)) {
          toast({ title: 'Invoice number already exists', description: 'Choose a unique invoice number for this company.', variant: 'destructive' });
          return;
        }
      }
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
          <div className="sm:col-span-2">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-medium">Invoice items</h3>
                <p className="text-[10.5px] text-muted-foreground">Add monthly fees, one-time website work, and extra charges as separate priced rows.</p>
              </div>
              <p className="text-[12px]">Subtotal <span className="num font-medium">{inr(invoiceSubtotal(lineItems))}</span></p>
            </div>
            <InvoiceLineItemsEditor items={lineItems} onChange={setLineItems} />
          </div>
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