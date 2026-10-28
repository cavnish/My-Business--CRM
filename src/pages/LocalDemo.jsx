import { Building2, CheckCircle2, CircleDollarSign, Clock3 } from 'lucide-react';
import CompanyMark from '@/components/shared/CompanyMark';
import StatusBadge from '@/components/shared/StatusBadge';
import StatCard from '@/components/shared/StatCard';
import WebofolioBrand from '@/components/branding/WebofolioBrand';
import { inr } from '@/lib/format';

const companies = [
  {
    id: 'demo-aster-house',
    name: 'Aster House Studio',
    industry: 'Interior design',
    monthly_fee: 48000,
    status: 'active',
    brand_color: '#356B58',
  },
  {
    id: 'demo-fieldline',
    name: 'Fieldline Foods',
    industry: 'Food and beverage',
    monthly_fee: 36000,
    status: 'active',
    brand_color: '#9A5E38',
  },
  {
    id: 'demo-morrow',
    name: 'Morrow Learning',
    industry: 'Education',
    monthly_fee: 52000,
    status: 'active',
    brand_color: '#526B8A',
  },
];

const tasks = [
  { title: 'Review the Aster House campaign', company: 'Aster House Studio', due: 'Today' },
  { title: 'Send the Fieldline monthly report', company: 'Fieldline Foods', due: 'Today' },
  { title: 'Approve the Morrow landing page', company: 'Morrow Learning', due: 'Tomorrow' },
];

export default function LocalDemo() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <WebofolioBrand subtitle="Business workspace preview" />
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Local demo
          </span>
        </header>

        <section className="mb-7 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <h1 className="text-lg font-semibold">Direct access preview</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            You are viewing sample data only. This local demo does not sign in, read, or change your saved workspace.
          </p>
        </section>

        <section aria-label="Workspace summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active clients" value="3 / 3" hint="sample companies" icon={Building2} />
          <StatCard label="Open pipeline" value={inr(184000, true)} hint="2 sample opportunities" icon={CircleDollarSign} />
          <StatCard label="Due today" value="2" hint="sample tasks" icon={Clock3} />
          <StatCard label="Completed this week" value="6" hint="sample activity" icon={CheckCircle2} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Company portfolio</h2>
              <p className="mt-1 text-xs text-muted-foreground">Example client records</p>
            </div>
            <ul className="divide-y divide-border">
              {companies.map((company) => (
                <li key={company.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyMark company={company} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{company.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{company.industry}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{inr(company.monthly_fee, true)}<span className="text-xs text-muted-foreground"> / mo</span></span>
                    <StatusBadge status={company.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Upcoming work</h2>
              <p className="mt-1 text-xs text-muted-foreground">Example tasks for this workspace</p>
            </div>
            <ul className="divide-y divide-border px-5">
              {tasks.map((task) => (
                <li key={task.title} className="flex items-start gap-3 py-4">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.company}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
