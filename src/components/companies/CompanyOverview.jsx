import React from 'react';
import { Globe, Mail, MapPin, Phone, User, Percent, CalendarDays, Wallet } from 'lucide-react';
import { InlineStat } from '@/components/shared/Field';
import StatusBadge from '@/components/shared/StatusBadge';
import { fmtDate, inr } from '@/lib/format';

export default function CompanyOverview({ company, metrics, upcoming, commercialAgreement, socialProfiles = [] }) {
  const services = company.services || [];
  const terms = commercialAgreement?.terms || {};
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[13px] font-medium">About the engagement</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {company.description || 'No description yet. Add a short note on what this company does and how you support them.'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <InlineStat label="Retainer" value={company.monthly_fee ? `${inr(company.monthly_fee, true)}/mo` : '—'} />
            <InlineStat label="Open tasks" value={metrics.openTasks} />
            <InlineStat label="Pipeline" value={inr(metrics.pipeline, true)} />
            <InlineStat label="Outstanding" value={inr(metrics.outstanding, true)} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[13px] font-medium">Services provided</h2>
          {services.length ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span key={s} className="rounded-full border border-border px-2.5 py-1 text-[11px]">{s}</span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">No services selected yet — edit the company to choose them.</p>
          )}
          <div className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Package</p>
              <p className="mt-0.5 text-[12px]">{company.service_package || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Billing cycle</p>
              <p className="mt-0.5 text-[12px]">{company.billing_cycle || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Payment terms</p>
              <p className="mt-0.5 text-[12px]">{company.payment_terms || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Commission</p>
              <p className="mt-0.5 text-[12px]">{company.commission_rate ? `${company.commission_rate}%` : 'None agreed'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Contract start</p>
              <p className="mt-0.5 text-[12px]">{fmtDate(company.contract_start, { year: false })}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Tax rate</p>
              <p className="mt-0.5 text-[12px]">{company.tax_rate ?? 0}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[13px] font-medium">Working notes</h2>
          <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
            {company.notes || 'No internal notes yet.'}
          </p>
        </div>

        {commercialAgreement && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium">Commercial tracking defaults</h2>
              <StatusBadge status={commercialAgreement.status} />
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Planning figures only. They are not invoices, confirmed balances, or permission to bill.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Term label="Website one-time fee" value={inr(terms.website_one_time_fee_inr)} detail="Verify against an actual invoice" />
              <Term label="Monthly management" value={`${inr(terms.monthly_management_fee_inr)}/mo`} detail="Proposed standard; confirm per company" />
              <Term label="Order commission" value={`${terms.commission_rate_percent}%`} detail={`Calculation base: ${terms.commission_base || 'To Confirm'}`} />
            </div>
            {terms.prior_monthly_discussion_inr && (
              <p className="mt-3 text-[11.5px] leading-relaxed text-amber-950 dark:text-amber-100">
                Prior discussion: {inr(terms.prior_monthly_discussion_inr)}/mo plus {terms.prior_commission_rate_percent}% commission.
                {' '}{terms.prior_monthly_discussion_note}
              </p>
            )}
            {terms.order_value_examples && (
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                2% examples: {Object.entries(terms.order_value_examples)
                  .map(([orderValue, commission]) => `${inr(orderValue)} → ${inr(commission)}`)
                  .join(' · ')}
              </p>
            )}
            {terms.internal_agency && (
              <p className="mt-3 text-[11.5px] font-medium leading-relaxed text-amber-950 dark:text-amber-100">
                Internal agency profile: client-style charges are not applicable unless a separate billed engagement is confirmed.
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-medium">Business profiles</h2>
            <span className="text-[10.5px] text-muted-foreground">Verify account ownership before use</span>
          </div>
          {socialProfiles.length ? (
            <div className="mt-3 space-y-2">
              {socialProfiles.map((profile) => (
                <div key={profile.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="w-24 shrink-0 text-muted-foreground">{profile.platform}</span>
                  {profile.profile_url ? (
                    <a href={profile.profile_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                      {profile.account_name || profile.profile_url}
                    </a>
                  ) : (
                    <span className="min-w-0 flex-1 text-muted-foreground">Official profile link not recorded</span>
                  )}
                  <StatusBadge status={profile.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">No profile URLs have been verified or supplied yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[13px] font-medium">Contact</h2>
          <div className="mt-3 space-y-2.5 text-[12px]">
            <Line icon={User} value={company.contact_person || 'Not set'} />
            <Line icon={Phone} value={company.phone || 'Not set'} />
            <Line icon={Mail} value={company.email || 'Not set'} />
            <Line icon={MapPin} value={company.address || 'Not set'} />
            <Line icon={Globe} value={company.domain || 'Not set'} href={company.domain ? `https://${company.domain}` : null} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[13px] font-medium">Next dates</h2>
          <div className="mt-3 space-y-2.5">
            {upcoming.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing scheduled ahead.</p>}
            {upcoming.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
                <span className="shrink-0 text-[11px]">{fmtDate(item.date, { year: false })}</span>
              </div>
            ))}
          </div>
          {company.domain_expiry && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[11.5px]">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Domain renews</span>
              <span className="ml-auto">{fmtDate(company.domain_expiry, { year: false })}</span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-[11.5px]">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Commission</span>
            <span className="ml-auto">{company.commission_rate || 0}%</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11.5px]">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Billed</span>
            <span className="ml-auto">{company.billing_cycle || 'Monthly'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Term({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-amber-200/70 bg-background/70 px-3 py-2 dark:border-amber-900">
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13px] font-medium">{value}</p>
      <p className="mt-0.5 text-[10.5px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function Line({ icon: Icon, value, href = null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="truncate text-foreground hover:underline">{value}</a>
      ) : (
        <span className="min-w-0 break-words text-foreground/85">{value}</span>
      )}
    </div>
  );
}