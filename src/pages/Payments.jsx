import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Download, Wallet, Search, AlertTriangle, Bell } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import DeleteButton from '@/components/shared/DeleteButton';
import PaymentForm from '@/components/forms/PaymentForm';
import PaymentReceiptForm from '@/components/forms/PaymentReceiptForm';
import EmptyState from '@/components/shared/EmptyState';
import useNewQuery from '@/hooks/useNewQuery';
import { downloadCsv } from '@/lib/exportCsv';
import { balanceDue, effectivePaymentStatus, fmtDate, inr, invoiceTotal, isOpenInvoice, monthKey, relative, todayISO } from '@/lib/format';
import { PAYMENT_STATUS } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';

export default function Payments() {
  const { toast } = useToast();
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('all');
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useNewQuery();
  const [editing, setEditing] = useState(null);
  const [newPaymentKind, setNewPaymentKind] = useState('');
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);

  const load = async () => {
    try {
      const [payRes, companyRes, transactionRes] = await Promise.all([
        neon.entities.Payment.list({ sort: '-due_date', limit: 300 }),
        neon.entities.Company.list({ limit: 60 }),
        neon.entities.PaymentTransaction.filter(companyId === 'all' ? {} : { company_id: companyId }, { sort: '-received_on', limit: 500 }),
      ]);
      setPayments(payRes.items || []);
      setCompanies(companyRes.items || []);
      setTransactions(transactionRes.items || []);
    } catch (error) {
      toast({ title: 'Could not load payments', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [companyId, status, search]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const visiblePayments = useMemo(() => payments.filter((payment) => {
    const matchesCompany = companyId === 'all' || payment.company_id === companyId;
    const matchesStatus = status === 'All' || effectivePaymentStatus(payment) === status;
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [payment.invoice_no, payment.title, companiesById[payment.company_id]?.name]
      .some((value) => String(value || '').toLowerCase().includes(needle));
    return matchesCompany && matchesStatus && matchesSearch;
  }), [payments, companyId, status, search, companiesById]);
  const invoicesById = useMemo(() => Object.fromEntries(payments.map((p) => [p.id, p])), [payments]);
  const openInvoices = visiblePayments.filter(isOpenInvoice);
  const outstanding = openInvoices.reduce((s, p) => s + balanceDue(p), 0);
  const overdue = openInvoices.filter((p) => p.due_date && p.due_date < todayISO());
  const receivedThisMonth = payments
    .filter((p) => !p.is_demo && p.payment_date && String(p.payment_date).slice(0, 7) === monthKey())
    .reduce((s, p) => s + Number(p.amount_received || 0), 0);
  const drafts = visiblePayments.filter((p) => effectivePaymentStatus(p) === 'Draft');

  const exportPayments = () => {
    downloadCsv(`payments-${todayISO()}.csv`, visiblePayments.map((payment) => ({ ...payment, display_status: effectivePaymentStatus(payment) })), [
      { label: 'Invoice', key: 'invoice_no' },
      { label: 'Client', value: (r) => companiesById[r.company_id]?.name || '' },
      { label: 'Description', key: 'title' },
      { label: 'Period', key: 'period' },
      { label: 'Total', value: (r) => invoiceTotal(r) },
      { label: 'Received', key: 'amount_received' },
      { label: 'Balance', value: (r) => balanceDue(r) },
      { label: 'Status', key: 'display_status' },
      { label: 'Due date', key: 'due_date' },
      { label: 'Reason pending', key: 'pending_reason' },
      { label: 'Next reminder', key: 'next_reminder' },
      { label: 'Demo example', key: 'is_demo' },
    ]);
  };

  const markPaid = async (payment) => {
    const remaining = balanceDue(payment);
    if (!isOpenInvoice(payment) || remaining <= 0 || settlingId) return;
    if (!globalThis.crypto?.randomUUID) {
      toast({ title: 'Secure settlement key unavailable', description: 'Use a modern browser to mark an invoice paid.', variant: 'destructive' });
      return;
    }
    setSettlingId(payment.id);
    try {
      const recorded = await neon.payments.recordReceipt({
        invoiceId: payment.id,
        amount: remaining,
        receivedOn: todayISO(),
        method: null,
        reference: null,
        notes: 'Balance settled from Payments.',
        idempotencyKey: `full-settlement-${payment.id}-${globalThis.crypto.randomUUID()}`,
      });
      const settled = Array.isArray(recorded) ? recorded[0] : recorded;
      if (settled?.id) {
        setPayments((current) => current.map((item) => item.id === payment.id ? settled : item));
      }
      await load();
      toast({ title: 'Invoice marked paid', description: 'The remaining balance was recorded as a receipt in the transaction ledger.' });
    } catch (error) {
      toast({ title: 'Could not record receipt', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSettlingId(null);
    }
  };

  const scheduleReminder = async (payment) => {
    try {
      await neon.entities.Payment.update(payment.id, { next_reminder: todayISO() });
      await load();
      toast({ title: 'Reminder scheduled', description: 'This invoice will be included in the next configured payment-reminder email.' });
    } catch (error) {
      toast({ title: 'Could not schedule reminder', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Money in"
        title="Payments"
        description="Who has paid, who has not, and exactly what happens next."
        actions={
          <>
            <button onClick={exportPayments} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /> Export</button>
            <button onClick={() => { setEditing(null); setNewPaymentKind(''); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Create invoice</button>
            <button onClick={() => { setEditing(null); setNewPaymentKind('Website one-time fee'); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground"><Plus className="h-3.5 w-3.5" /> Website fee</button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ['Received this month', inr(receivedThisMonth), 'text-emerald-700'],
          ['Outstanding', inr(outstanding), ''],
          ['Overdue', inr(overdue.reduce((s, p) => s + balanceDue(p), 0)), overdue.length ? 'text-destructive' : ''],
          ['Drafts', drafts.length, ''],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className={`num mt-1 text-[17px] font-medium ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {['All', ...PAYMENT_STATUS].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${status === s ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>{s}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice no." className="h-8 w-32 rounded-lg border border-input bg-card pl-7 pr-2 text-[11.5px] outline-none focus:border-ring" />
          </div>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-8 max-w-[160px] rounded-lg border border-input bg-card px-2 text-[11.5px]">
            <option value="all">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card/60" />
      ) : visiblePayments.length === 0 ? (
        <EmptyState icon={Wallet} title="No invoices in this view" description="Create an invoice to start tracking what is due and what has landed." action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Create an invoice</button>} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-3 py-2.5 font-medium">Client</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th className="px-3 py-2.5 text-right font-medium">Received</th>
                  <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                  <th className="px-3 py-2.5 font-medium">Due</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Next step</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {visiblePayments.map((p) => {
                  const effectiveStatus = effectivePaymentStatus(p);
                  const isOverdueRow = effectiveStatus === 'Overdue';
                  return (
                    <tr key={p.id} className="cursor-pointer align-top transition hover:bg-muted/25" onClick={() => { setEditing(p); setFormOpen(true); }}>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-medium">{p.invoice_no || 'No number'} {p.is_demo && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800">DEMO</span>}</p>
                        <p className="text-[10.5px] text-muted-foreground">{p.title}</p>
                        {p.period && <p className="text-[10px] text-muted-foreground/80">Period {p.period}</p>}
                      </td>
                      <td className="px-3 py-3 text-[11.5px]">{companiesById[p.company_id]?.name || '—'}</td>
                      <td className="num px-3 py-3 text-right text-[12px]">{inr(invoiceTotal(p))}</td>
                      <td className="num px-3 py-3 text-right text-[12px] text-muted-foreground">{inr(p.amount_received)}</td>
                      <td className="num px-3 py-3 text-right text-[12px] font-medium">{balanceDue(p) ? inr(balanceDue(p)) : '—'}</td>
                      <td className="px-3 py-3 text-[11px]">
                        <span className={isOverdueRow ? 'font-medium text-destructive' : 'text-muted-foreground'}>{fmtDate(p.due_date, { year: false })}</span>
                        {isOpenInvoice(p) && p.due_date && <span className="block text-[10px] text-muted-foreground">{relative(p.due_date)}</span>}
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={effectiveStatus} /></td>
                      <td className="max-w-[190px] px-3 py-3">
                        {p.pending_reason ? (
                          <p className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{p.pending_reason}</p>
                        ) : effectiveStatus === 'Paid' ? (
                          <p className="text-[10.5px] text-emerald-700">Settled {p.payment_date ? fmtDate(p.payment_date, { year: false }) : ''}</p>
                        ) : (
                          <p className="text-[10.5px] text-muted-foreground">No reason noted</p>
                        )}
                        {p.next_reminder && isOpenInvoice(p) && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#A87A44]"><AlertTriangle className="h-2.5 w-2.5" /> reminder {relative(p.next_reminder)}</p>}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {isOpenInvoice(p) && (
                            <>
                              <button onClick={() => { setReceiptInvoice(p); setReceiptOpen(true); }} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted">Add receipt</button>
                              <button onClick={() => scheduleReminder(p)} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"><Bell className="mr-1 inline h-2.5 w-2.5" />Remind</button>
                              {balanceDue(p) > 0 && <button disabled={settlingId === p.id} onClick={() => markPaid(p)} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted disabled:cursor-wait disabled:opacity-60">{settlingId === p.id ? 'Marking…' : 'Mark paid'}</button>}
                            </>
                          )}
                          <DeleteButton onConfirm={async () => { await neon.entities.Payment.delete(p.id); load(); }} label="invoice" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-[13px] font-medium">Payment transaction ledger</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Actual receipts are stored separately from invoices and demo examples.</p>
        </div>
        {transactions.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">No actual receipts have been recorded.</p>
        ) : (
          <div className="divide-y divide-border/70">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="grid gap-1 px-4 py-3 text-[11.5px] sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                <span className="font-medium">{companiesById[transaction.company_id]?.name || 'Company'}</span>
                <span className="text-muted-foreground">{invoicesById[transaction.invoice_id]?.invoice_no || 'Invoice'} · {fmtDate(transaction.received_on)}</span>
                <span className="text-muted-foreground">{transaction.method || 'Method To Confirm'}</span>
                <span className="num font-medium">{inr(transaction.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <PaymentForm open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) { setEditing(null); setNewPaymentKind(''); } }} companies={companies} companyId={companyId !== 'all' ? companyId : ''} payment={editing} initialKind={newPaymentKind} onSaved={load} />
      <PaymentReceiptForm
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) setReceiptInvoice(null);
        }}
        payment={receiptInvoice}
        onSaved={load}
      />
    </div>
  );
}
