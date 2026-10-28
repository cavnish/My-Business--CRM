import React, { useEffect, useMemo, useState } from 'react';
import { Printer, FileDown, Receipt, Info, Save, Plus, MonitorSmartphone } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import BillDocument from '@/components/bills/BillDocument';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/components/ui/use-toast';
import { balanceDue, inr, isOpenInvoice, monthKey, monthLabel, todayISO } from '@/lib/format';
import { downloadCsv } from '@/lib/exportCsv';
import InvoiceLineItemsEditor from '@/components/bills/InvoiceLineItemsEditor';
import { invoiceSubtotal, lineAmount, savedLineItems } from '@/lib/invoiceItems';

const MODES = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'report', label: 'Work report' },
  { key: 'combined', label: 'Combined' },
];

export default function Bills() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [month, setMonth] = useState(monthKey());
  const [mode, setMode] = useState('combined');
  const [includeLeads, setIncludeLeads] = useState('none');
  const [includeProjects, setIncludeProjects] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState({ tasks: [], seo: [], posts: [], projects: [], payments: [], leads: [] });
  const [agreementTerms, setAgreementTerms] = useState({ website_one_time_fee_inr: 0 });
  const [extraLinesByScope, setExtraLinesByScope] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [companyRes, me] = await Promise.all([
        neon.entities.Company.list({ sort: '-created_date', limit: 60 }),
        neon.auth.me().catch(() => null),
      ]);
      setCompanies(companyRes.items || []);
      setUser(me);
      if (companyRes.items?.[0]) setCompanyId(companyRes.items[0].id);
    };
    init();
  }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [tasks, seo, posts, projects, payments, leads, agreement] = await Promise.all([
        neon.entities.Task.filter({ company_id: companyId }, { limit: 300 }),
        neon.entities.SeoTask.filter({ company_id: companyId }, { limit: 200 }),
        neon.entities.SocialPost.filter({ company_id: companyId }, { limit: 200 }),
        neon.entities.Project.filter({ company_id: companyId }, { limit: 100 }),
        neon.entities.Payment.filter({ company_id: companyId }, { limit: 200 }),
        neon.entities.Lead.filter({ company_id: companyId }, { limit: 200 }),
        neon.entities.CommercialAgreement.filter({ company_id: companyId }, { sort: '-updated_date', limit: 1 }),
      ]);
      setAgreementTerms(agreement.items?.[0]?.terms || {});
      setRecords({
        tasks: tasks.items || [], seo: seo.items || [], posts: posts.items || [],
        projects: projects.items || [], payments: payments.items || [], leads: leads.items || [],
      });
    } catch (error) {
      toast({ title: 'Could not load billing data', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const company = companies.find((c) => c.id === companyId);
  const extraLinesKey = `${companyId}:${month}`;
  const extraLines = extraLinesByScope[extraLinesKey] || [];

  const addExtraLine = (line) => setExtraLinesByScope((current) => ({
    ...current,
    [extraLinesKey]: [...(current[extraLinesKey] || []), line],
  }));

  const updateExtraLines = (updated) => setExtraLinesByScope((current) => ({
    ...current,
    [extraLinesKey]: updated,
  }));

  useEffect(() => {
    if (!company) return;
    const prefix = user?.invoice_prefix || 'INV';
    const seq = records.payments.filter((payment) => !payment.is_demo && payment.invoice_no).length + 1;
    setInvoiceNo(`${prefix}-${month.replace('-', '')}-${String(seq).padStart(3, '0')}`);
  }, [companyId, month, records.payments.length, user]);

  useEffect(() => {
    if (!company) return;
    const days = Number(String(company.payment_terms || '').replace(/\D/g, ''));
    if (!days) {
      setDueDate('');
      return;
    }
    const due = new Date(invoiceDate);
    due.setDate(due.getDate() + days);
    setDueDate(due.toISOString().slice(0, 10));
  }, [invoiceDate, company]);

  const report = useMemo(() => {
    const tasksDone = records.tasks.filter((t) => !t.is_demo && t.status === 'Done' && String(t.completed_date).slice(0, 7) === month);
    const seoDone = records.seo.filter((s) => !s.is_demo && s.status === 'Done' && String(s.completed_date).slice(0, 7) === month);
    const postsDone = records.posts.filter((p) => !p.is_demo && p.status === 'Published' && String(p.scheduled_date).slice(0, 7) === month);
    const projects = records.projects.filter((p) => !p.is_demo && p.status !== 'Cancelled' && (String(p.updated_date).slice(0, 7) === month || ['In Progress', 'Awaiting Client'].includes(p.status)));
    const pending = records.tasks.filter((t) => !t.is_demo && t.status !== 'Done');
    const leads = records.leads.filter((l) => !l.is_demo && String(l.created_date).slice(0, 7) === month);
    return { tasksDone, seoDone, postsDone, projects, pending, leads };
  }, [records, month]);

  const completedProjects = records.projects.filter((p) => !p.is_demo && p.status === 'Completed' && String(p.updated_date).slice(0, 7) === month && Number(p.fee) > 0);

  const lines = useMemo(() => {
    const items = [];
    if (company?.monthly_fee) {
      items.push({ description: `${company.service_package || 'Monthly service retainer'} — ${monthLabel(month)}`, note: (company.services || []).join(', '), qty: 1, rate: Number(company.monthly_fee), amount: Number(company.monthly_fee) });
    }
    if (includeProjects) {
      completedProjects.forEach((p) => items.push({ description: `Project completed — ${p.name}`, qty: 1, rate: Number(p.fee), amount: Number(p.fee) }));
    }
    items.push(...extraLines.map((item) => ({
      ...item,
      description: String(item.description || '').trim(),
      qty: Number(item.qty) || 0,
      rate: Number(item.rate) || 0,
      amount: lineAmount(item),
    })));
    return items;
  }, [company, month, includeProjects, completedProjects, extraLines]);

  const subtotal = invoiceSubtotal(lines);
  const suggestedWebsiteFee = Number(agreementTerms.website_one_time_fee_inr) || 0;
  const discountValue = Number(discount) || 0;
  const taxRate = Number(company?.tax_rate || 0);
  const taxAmount = Math.round(Math.max(0, subtotal) * taxRate / 100);
  const totalValue = Math.max(0, subtotal + taxAmount - discountValue);
  const received = records.payments.filter((p) => !p.is_demo && String(p.payment_date).slice(0, 7) === month).reduce((s, p) => s + Number(p.amount_received || 0), 0);
  const outstandingOther = records.payments.filter((p) => isOpenInvoice(p) && p.period !== month).reduce((s, p) => s + balanceDue(p), 0);
  const previousBalance = outstandingOther + received;
  const balance = Math.max(0, totalValue + previousBalance - received);

  const business = {
    name: user?.business_name || user?.full_name || '',
    tagline: user?.business_tagline || '',
    address: user?.business_address || '',
    phone: user?.business_phone || '',
    email: user?.business_email || user?.email || '',
    gstin: user?.business_gstin || '',
    payment_instructions: user?.payment_instructions || '',
    terms: user?.invoice_terms || '',
  };

  const documentData = {
    business, company, mode, lines, includeLeads, leads: report.leads,
    invoiceNo, invoiceDate, dueDate, periodLabel: monthLabel(month),
    totals: { subtotal, discount: discountValue, taxRate, taxAmount, total: totalValue, previousBalance, received, balance },
    report: { ...report, note: nextFocus },
  };

  const saveInvoice = async () => {
    if (!company) return;
    const exists = records.payments.some((p) => !p.is_demo && p.invoice_no === invoiceNo);
    if (exists) {
      toast({ title: 'Invoice already recorded', description: `${invoiceNo} already exists for this company.`, variant: 'destructive' });
      return;
    }
    const savedItems = savedLineItems(lines);
    const invalidExtraLine = extraLines.some((item) => (
      !String(item.description || '').trim()
      || !Number.isFinite(Number(item.qty))
      || Number(item.qty) <= 0
      || item.rate === ''
      || item.rate === null
      || item.rate === undefined
      || !Number.isFinite(Number(item.rate))
      || Number(item.rate) < 0
    ));
    if (!savedItems.length || invalidExtraLine || savedItems.some((item) => !item.description || item.qty <= 0 || item.rate < 0)) {
      toast({ title: 'Nothing to invoice', description: 'Set a monthly fee on the company or include a completed project.', variant: 'destructive' });
      return;
    }
    if (discountValue < 0 || discountValue > subtotal + taxAmount) {
      toast({ title: 'Check the discount', description: 'The discount must be non-negative and no greater than the invoice total.', variant: 'destructive' });
      return;
    }
    const invoiceKind = savedItems.some((item) => /website.*one.?time/i.test(item.description))
      ? 'Website one-time fee'
      : savedItems.some((item) => /extra work/i.test(item.description))
        ? 'Extra work'
        : 'Monthly service fee';
    setSaving(true);
    try {
      await neon.entities.Payment.create({
        company_id: company.id,
        invoice_no: invoiceNo,
        title: invoiceKind === 'Website one-time fee'
          ? `${company.name} — Website one-time fee`
          : `${monthLabel(month)} — ${company.service_package || 'Monthly service'}`,
        kind: invoiceKind,
        period: month,
        amount: subtotal,
        line_items: savedItems,
        tax_rate: taxRate,
        discount: discountValue,
        amount_received: 0,
        status: 'Pending',
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        notes: `Generated from a ${mode} document.`,
      });
      toast({ title: 'Invoice saved as pending', description: `${invoiceNo} is now in Payments.` });
      await load();
    } catch (error) {
      toast({ title: 'Could not save invoice', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const exportWork = () => {
    downloadCsv(`work-report-${month}.csv`, [
      ...report.tasksDone.map((t) => ({ type: 'Task', date: t.completed_date, work: t.title, detail: t.category })),
      ...report.seoDone.map((s) => ({ type: 'SEO', date: s.completed_date, work: s.title, detail: s.target_page })),
      ...report.postsDone.map((p) => ({ type: 'Content', date: p.scheduled_date, work: p.title, detail: `${p.platform} · ${p.post_type}` })),
    ], [
      { label: 'Category', key: 'type' },
      { label: 'Date', key: 'date' },
      { label: 'Work', key: 'work' },
      { label: 'Detail', key: 'detail' },
    ]);
  };

  if (!companies.length) {
    return <EmptyState icon={Receipt} title="Add a company first" description="Bills are built from a company's recorded work for a month." />;
  }

  return (
    <div className="fade-up">
      <div className="no-print">
        <PageHeader
          eyebrow="Billing"
          title="Bills & reports"
          description="Pull a month of real work into a client-ready invoice or work report."
          actions={
            <>
              <button onClick={exportWork} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"><FileDown className="h-3.5 w-3.5" /> Export work</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"><Printer className="h-3.5 w-3.5" /> Print / save PDF</button>
              <button onClick={saveInvoice} disabled={saving || mode === 'report'} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-40"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save invoice'}</button>
            </>
          }
        />

        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Company</span>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[12px]">
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Billing month</span>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[12px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Document</span>
              <div className="flex h-9 rounded-lg border border-input bg-card p-0.5">
                {MODES.map((m) => (
                  <button key={m.key} onClick={() => setMode(m.key)} className={`flex-1 rounded-md px-1 text-[11px] transition ${mode === m.key ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'}`}>{m.label}</button>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Lead details</span>
              <select value={includeLeads} onChange={(e) => setIncludeLeads(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[12px]">
                <option value="none">Do not include leads</option>
                <option value="summary">Summary only</option>
                <option value="individual">Individual leads</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Invoice number</span>
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[12px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Invoice date</span>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[12px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Balance discount (₹)</span>
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[12px]" />
            </label>
            <label className="flex items-end gap-2 pb-2 text-[11.5px] text-muted-foreground">
              <input type="checkbox" checked={includeProjects} onChange={(e) => setIncludeProjects(e.target.checked)} className="accent-[#1F4D3D]" />
              Add completed project fees ({completedProjects.length})
            </label>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[12.5px] font-medium">Additional invoice items</h3>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  Add website setup or extra work charges. {suggestedWebsiteFee ? `The ₹${suggestedWebsiteFee.toLocaleString('en-IN')} website figure is only an unconfirmed planning reference; verify before billing.` : 'Enter the actual agreed amount before saving.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => addExtraLine({ description: 'Extra work', qty: 1, rate: '' })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" /> Extra work
                </button>
                <button
                  type="button"
                  onClick={() => addExtraLine({ description: 'Website one-time fee', qty: 1, rate: suggestedWebsiteFee || '' })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] hover:bg-muted"
                >
                  <MonitorSmartphone className="h-3.5 w-3.5" /> Website fee
                </button>
              </div>
            </div>
            <InvoiceLineItemsEditor items={extraLines} onChange={updateExtraLines} />
          </div>

          {mode !== 'invoice' && (
            <label className="mt-2 block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Next month’s focus (appears in the report)</span>
              <textarea value={nextFocus} onChange={(e) => setNextFocus(e.target.value)} rows={2} placeholder="What you will prioritise next month…" className="w-full rounded-lg border border-input bg-card px-2.5 py-2 text-[12px] outline-none focus:border-ring" />
            </label>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
            <span>Subtotal <span className="num font-medium text-foreground">{inr(subtotal)}</span></span>
            <span>Tax <span className="num font-medium text-foreground">{inr(taxAmount)}</span></span>
            <span>Total <span className="num font-medium text-foreground">{inr(totalValue)}</span></span>
            <span>Previous balance <span className="num">{inr(previousBalance)}</span></span>
            <span>Received this month <span className="num">{inr(received)}</span></span>
            <span className="ml-auto flex items-center gap-1"><Info className="h-3 w-3" /> Business details live in Settings.</span>
          </div>
        </div>
      </div>

      {loading || !company ? (
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-card/60" />
      ) : (
        <BillDocument data={documentData} />
      )}
      <p className="no-print mt-3 text-center text-[10.5px] text-muted-foreground">
        Use your browser’s print dialog to save a PDF. Nothing is marked paid when a document is generated.
      </p>
    </div>
  );
}