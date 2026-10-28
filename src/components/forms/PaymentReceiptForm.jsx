import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { balanceDue, inr, todayISO } from '@/lib/format';
import { neon } from '@/api/neonDataClient';

export default function PaymentReceiptForm({ open, onOpenChange, payment, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ amount: '', received_on: todayISO(), method: '', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({ amount: '', received_on: todayISO(), method: '', reference: '', notes: '' });
    idempotencyKey.current = null;
  }, [open, payment?.id]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const amount = Number(form.amount);
    const remaining = balanceDue(payment);
    if (!payment || !Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      toast({
        title: 'Check the receipt amount',
        description: `Enter an amount above zero and no greater than the remaining balance of ${inr(remaining)}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!idempotencyKey.current) {
      if (!globalThis.crypto?.randomUUID) {
        toast({ title: 'Secure receipt key unavailable', description: 'Use a modern browser to record receipts.', variant: 'destructive' });
        return;
      }
      idempotencyKey.current = globalThis.crypto.randomUUID();
    }

    setSaving(true);
    try {
      await neon.payments.recordReceipt({
        invoiceId: payment.id,
        amount,
        receivedOn: form.received_on || null,
        method: form.method.trim() || null,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
        idempotencyKey: idempotencyKey.current,
      });
      toast({ title: 'Receipt recorded', description: `${inr(amount)} was added to the payment transaction ledger.` });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: 'Could not record receipt', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Record receipt</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Invoice {payment?.invoice_no || payment?.title} · remaining balance {inr(balanceDue(payment))}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount received (₹)">
            <Input type="number" min="0.01" step="0.01" max={balanceDue(payment)} value={form.amount} onChange={(event) => set('amount', event.target.value)} />
          </Field>
          <Field label="Received date">
            <Input type="date" value={form.received_on} onChange={(event) => set('received_on', event.target.value)} />
          </Field>
          <Field label="Payment method">
            <Input value={form.method} onChange={(event) => set('method', event.target.value)} placeholder="To Confirm" />
          </Field>
          <Field label="Reference">
            <Input value={form.reference} onChange={(event) => set('reference', event.target.value)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.amount}>{saving ? 'Saving…' : 'Save receipt'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
