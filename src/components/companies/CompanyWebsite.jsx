import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { fmtDate } from '@/lib/format';

export default function CompanyWebsite({ company }) {
  const [copied, setCopied] = useState('');

  const copy = (label, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1400);
  };

  const fields = [
    ['Website', company.domain, company.domain ? `https://${company.domain}` : null],
    ['Hosting', company.hosting_provider],
    ['Registrar', company.domain_registrar],
    ['Domain expiry', company.domain_expiry ? fmtDate(company.domain_expiry) : ''],
    ['Deployment', company.deployment_platform],
    ['Framework', company.framework],
    ['Database', company.database_provider],
    ['Analytics ID', company.analytics_id],
    ['Admin panel', company.admin_url, company.admin_url],
    ['Repository', company.repository_url, company.repository_url],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[13px] font-medium">Website & infrastructure</h2>
        <div className="mt-3 divide-y divide-border/70">
          {fields.map(([label, value, href]) => (
            <div key={label} className="flex items-center gap-2 py-2 text-[12px]">
              <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
              <span className="min-w-0 flex-1 truncate text-foreground/85">{value || '—'}</span>
              {href && (
                <a href={href} target="_blank" rel="noreferrer" className="rounded p-1 text-muted-foreground hover:text-foreground" title="Open">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {value && (
                <button onClick={() => copy(label, value)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Copy">
                  {copied === label ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[13px] font-medium">Technical notes</h2>
          <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
            {company.website_notes || 'No technical notes yet. Record ongoing issues, improvements and deployment history here.'}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7DCC8] bg-[#FBF7EF] p-4">
          <p className="text-[11.5px] font-medium">About credentials</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Passwords and API keys are never stored in company notes. Keep them in your password manager or the hosting provider’s access controls, and record only the setup steps that are safe to share.
          </p>
        </div>
      </div>
    </div>
  );
}