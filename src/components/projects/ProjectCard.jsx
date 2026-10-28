import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import CompanyMark from '@/components/shared/CompanyMark';
import StatusBadge from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/Field';
import { fmtDate, inr, relative } from '@/lib/format';

export default function ProjectCard({ project, company }) {
  return (
    <Link to={`/projects/${project.id}`} className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_10px_30px_-22px_rgba(16,42,36,0.35)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CompanyMark company={company} size="sm" />
          <span className="truncate text-[10.5px] text-muted-foreground">{company?.name || 'Internal'}</span>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-medium leading-snug">{project.name}</h3>
        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition group-hover:text-foreground" />
      </div>
      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">{project.description || 'No description added.'}</p>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Progress</span>
          <span className="num">{project.progress || 0}%</span>
        </div>
        <ProgressBar value={project.progress} />
      </div>

      <div className="mt-auto flex items-end justify-between border-t border-border/70 pt-3 text-[11px]">
        <div>
          <p className="text-[10px] text-muted-foreground">Deadline</p>
          <p className={`mt-0.5 ${project.status !== 'Completed' && project.deadline && project.deadline < new Date().toISOString().slice(0, 10) ? 'font-medium text-destructive' : ''}`}>
            {fmtDate(project.deadline, { year: false })} {project.status !== 'Completed' && project.deadline ? `· ${relative(project.deadline)}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Fee</p>
          <p className="num mt-0.5">{project.fee ? inr(project.fee, true) : '—'}</p>
        </div>
      </div>
    </Link>
  );
}