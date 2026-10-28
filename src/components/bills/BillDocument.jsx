import React from 'react';
import CompanyMark from '@/components/shared/CompanyMark';
import { fmtDate, inr } from '@/lib/format';

const LABEL = { invoice: 'Invoice', report: 'Monthly work report', combined: 'Invoice & work report' };

export default function BillDocument({ data }) {
  const { business, company, mode, lines, totals } = data;
  const showInvoice = mode !== 'report';
  const showReport = mode !== 'invoice';

  return (
    <div id="bill-document" className="print-sheet mx-auto w-full max-w-[860px] rounded-2xl border border-border bg-white p-7 text-[#1B2A26] shadow-sm sm:p-10">
      <div className="flex flex-col justify-between gap-6 border-b border-[#E6E1D6] pb-6 sm:flex-row">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1F4D3D] font-display text-xl text-white">
            {(business.name || 'S')[0]}
          </span>
          <div>
            <p className="font-display text-[24px] leading-tight">{business.name || 'Your business'}</p>
            {business.tagline && <p className="text-[11.5px] text-[#61706B]">{business.tagline}</p>}
            <div className="mt-2 space-y-0.5 text-[10.5px] leading-relaxed text-[#61706B]">
              {business.address && <p>{business.address}</p>}
              <p>{[business.phone, business.email].filter(Boolean).join(' · ')}</p>
              {business.gstin && <p>GSTIN {business.gstin}</p>}
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#8A968F]">{LABEL[mode]}</p>
          <p className="mt-1 text-[15px] font-medium">{data.invoiceNo}</p>
          <div className="mt-2 space-y-0.5 text-[10.5px] text-[#61706B]">
            <p>Issued {fmtDate(data.invoiceDate)}</p>
            <p>Period {data.periodLabel}</p>
            {showInvoice && data.dueDate && <p>Due {fmtDate(data.dueDate)}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 py-5 sm:flex-row">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.16em] text-[#8A968F]">Prepared for</p>
          <div className="mt-1.5 flex items-center gap-2">
            <CompanyMark company={company} size="sm" />
            <div>
              <p className="text-[13px] font-medium">{company.name}</p>
              <p className="text-[10.5px] text-[#61706B]">{company.contact_person || company.domain || ''}</p>
            </div>
          </div>
          {company.address && <p className="mt-2 max-w-[280px] text-[10.5px] leading-relaxed text-[#61706B]">{company.address}</p>}
        </div>
        <div className="text-[10.5px] text-[#61706B] sm:text-right">
          {company.email && <p>{company.email}</p>}
          {company.phone && <p>{company.phone}</p>}
          {company.domain && <p>{company.domain}</p>}
          {company.payment_terms && <p className="mt-1">Terms: {company.payment_terms}</p>}
        </div>
      </div>

      {showInvoice && (
        <div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-[#E6E1D6] text-[9.5px] uppercase tracking-[0.12em] text-[#8A968F]">
                <th className="py-2 font-medium">Description</th>
                <th className="w-12 py-2 text-center font-medium">Qty</th>
                <th className="w-24 py-2 text-right font-medium">Rate</th>
                <th className="w-24 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-[#F0ECE3] align-top">
                  <td className="py-2.5 pr-3">
                    <p className="text-[11.5px]">{line.description}</p>
                    {line.note && <p className="mt-0.5 text-[9.5px] text-[#8A968F]">{line.note}</p>}
                  </td>
                  <td className="py-2.5 text-center text-[11px]">{line.qty || 1}</td>
                  <td className="num py-2.5 text-right text-[11px]">{inr(line.rate)}</td>
                  <td className="num py-2.5 text-right text-[11.5px]">{inr(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-[280px] space-y-1.5 text-[11px]">
              <Row label="Subtotal" value={inr(totals.subtotal)} />
              {totals.discount > 0 && <Row label="Discount" value={`− ${inr(totals.discount)}`} />}
              <Row label={`GST (${totals.taxRate}%)`} value={inr(totals.taxAmount)} />
              <div className="flex items-center justify-between border-y border-[#DCD5C6] py-2 text-[13px] font-medium">
                <span>Total</span><span className="num">{inr(totals.total)}</span>
              </div>
              {totals.previousBalance > 0 && <Row label="Previous balance" value={inr(totals.previousBalance)} />}
              {totals.received > 0 && <Row label="Payments received" value={`− ${inr(totals.received)}`} />}
              <div className="flex items-center justify-between rounded-md bg-[#F5F1E8] px-2 py-2 text-[12px] font-medium">
                <span>Balance due</span><span className="num">{inr(totals.balance)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#E6E1D6] bg-[#FBF9F4] px-4 py-3">
            <p className="text-[9.5px] uppercase tracking-[0.14em] text-[#8A968F]">Payment instructions</p>
            <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-[#4B5A54]">
              {business.payment_instructions || `Please transfer the amount to the account shared separately, quoting ${data.invoiceNo}.`}
            </p>
            {business.terms && <p className="mt-1.5 text-[10px] text-[#8A968F]">{business.terms}</p>}
          </div>
        </div>
      )}

      {showReport && (
        <div className={showInvoice ? 'mt-8 break-before-page border-t border-[#E6E1D6] pt-6' : ''}>
          <p className="text-[9.5px] uppercase tracking-[0.18em] text-[#8A968F]">Work completed · {data.periodLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Tasks completed', data.report.tasksDone.length],
              ['SEO tasks closed', data.report.seoDone.length],
              ['Posts published', data.report.postsDone.length],
              ['Projects touched', data.report.projects.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[#E6E1D6] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-[0.1em] text-[#8A968F]">{label}</p>
                <p className="num mt-0.5 font-display text-[20px]">{value}</p>
              </div>
            ))}
          </div>

          <ReportSection title="Completed work" items={data.report.tasksDone.map((t) => t.title)} empty="No tasks were marked complete in this period." />
          <ReportSection title="SEO activity" items={data.report.seoDone.map((t) => `${t.title}${t.target_page ? ` — ${t.target_page}` : ''}`)} empty="No SEO tasks closed in this period." />
          <ReportSection title="Content published" items={data.report.postsDone.map((p) => `${p.platform}: ${p.title}`)} empty="No posts published in this period." />
          <ReportSection title="Projects in motion" items={data.report.projects.map((p) => `${p.name} — ${p.status} (${p.progress || 0}%)`)} empty="No active projects this period." />
          <ReportSection title="Carried into next month" items={data.report.pending.map((t) => `${t.title}${t.due_date ? ` (due ${fmtDate(t.due_date, { year: false })})` : ''}`)} empty="Nothing carried forward." />
          {data.report.note && (
            <div className="mt-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A968F]">Next month’s focus</p>
              <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-[#4B5A54]">{data.report.note}</p>
            </div>
          )}
        </div>
      )}

      {data.includeLeads !== 'none' && data.leads.length > 0 && (
        <div className="mt-6">
          <p className="text-[9.5px] uppercase tracking-[0.18em] text-[#8A968F]">Lead activity this month</p>
          {data.includeLeads === 'summary' ? (
            <p className="mt-1.5 text-[10.5px] text-[#4B5A54]">
              {data.leads.length} new enquiries · {data.leads.filter((l) => l.status === 'Won').length} won · {inr(data.leads.reduce((s, l) => s + Number(l.estimated_value || 0), 0))} total estimated value.
            </p>
          ) : (
            <table className="mt-2 w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-[#E6E1D6] text-[9px] uppercase tracking-[0.1em] text-[#8A968F]">
                  <th className="py-1.5 font-medium">Lead</th><th className="py-1.5 font-medium">Source</th><th className="py-1.5 font-medium">Stage</th><th className="py-1.5 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.slice(0, 12).map((l) => (
                  <tr key={l.id} className="border-b border-[#F0ECE3]">
                    <td className="py-1.5">{l.name}{l.company_name ? ` · ${l.company_name}` : ''}</td>
                    <td className="py-1.5 text-[#61706B]">{l.source}</td>
                    <td className="py-1.5 text-[#61706B]">{l.status}</td>
                    <td className="num py-1.5 text-right">{inr(l.estimated_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="mt-8 flex items-end justify-between border-t border-[#E6E1D6] pt-4">
        <p className="text-[9.5px] leading-relaxed text-[#8A968F]">
          {showInvoice ? 'This is a computer-generated invoice.' : 'Work report generated from recorded activity.'}<br />
          {business.name || ''}
        </p>
        <div className="text-right">
          <div className="mb-1 h-8 w-36 border-b border-[#D8D0C0]" />
          <p className="text-[9.5px] text-[#8A968F]">Authorised signature</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex items-center justify-between text-[#61706B]"><span>{label}</span><span className="num">{value}</span></div>;
}

function ReportSection({ title, items, empty }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A968F]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-[10.5px] text-[#8A968F]">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.slice(0, 14).map((item, i) => (
            <li key={i} className="flex gap-2 text-[10.5px] leading-relaxed text-[#4B5A54]">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#B9A98A]" />
              {item}
            </li>
          ))}
          {items.length > 14 && <li className="text-[10px] text-[#8A968F]">+ {items.length - 14} more</li>}
        </ul>
      )}
    </div>
  );
}