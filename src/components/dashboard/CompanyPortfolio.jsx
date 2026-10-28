import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import CompanyMark from '@/components/shared/CompanyMark';
import StatusBadge from '@/components/shared/StatusBadge';
import { inr } from '@/lib/format';

/**
 * @typedef {Object} PortfolioCompany
 * @property {string} id
 * @property {string} name
 * @property {string} [domain]
 * @property {string} [industry]
 * @property {number|string} [monthly_fee]
 * @property {string} [status]
 * @property {string} [brand_color]
 * @property {string} [logo_url]
 */

/**
 * @param {{
 *   companies?: PortfolioCompany[],
 *   metrics?: Record<string, {openTasks?: number, pipeline?: number, outstanding?: number}>,
 *   loading?: boolean
 * }} props
 */
export default function CompanyPortfolio({ companies = [], metrics = {}, loading }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[13px] font-medium">Company portfolio</h2>
          <p className="text-[11px] text-muted-foreground">Every client, every retainer</p>
        </div>
        <Link to="/companies" className="text-[11.5px] text-muted-foreground hover:text-foreground">View all</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-border/70 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Retainer</th>
              <th className="px-3 py-2 font-medium">Open tasks</th>
              <th className="px-3 py-2 font-medium">Pipeline</th>
              <th className="px-3 py-2 font-medium">Outstanding</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-[12px] text-muted-foreground">Loading portfolio…</td></tr>}
            {!loading && companies.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-[12px] text-muted-foreground">Add your first company to begin.</td></tr>}
            {companies.map((c) => {
              const m = metrics[c.id] || {};
              return (
                <tr key={c.id} className="group transition hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link to={`/companies/${c.id}`} className="flex items-center gap-2.5">
                      <CompanyMark company={c} size="sm" />
                      <span className="min-w-0">
                        <span className="block max-w-[220px] truncate text-[12.5px] font-medium">{c.name}</span>
                        <span className="block text-[10.5px] text-muted-foreground">{c.domain || c.industry || '—'}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="num px-3 py-3 text-[12px]">{inr(c.monthly_fee, true)}</td>
                  <td className="px-3 py-3 text-[12px]">{m.openTasks || 0}</td>
                  <td className="num px-3 py-3 text-[12px]">{inr(m.pipeline || 0, true)}</td>
                  <td className="num px-3 py-3 text-[12px]">{m.outstanding ? inr(m.outstanding, true) : '—'}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/companies/${c.id}`} className="inline-flex rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}