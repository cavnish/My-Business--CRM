import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, ArrowRight } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { isOverdue, relative } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function TodayList({ tasks = [], companiesById = {}, onToggle, emptyText = 'Nothing due today. A clear desk.', title = 'Today’s focus', subtitle = 'Tasks due today and anything overdue' }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[13px] font-medium">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <Link to="/tasks" className="flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground">
          All tasks <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-border/70">
        {tasks.length === 0 && <p className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">{emptyText}</p>}
        {tasks.map((task) => {
          const overdue = isOverdue(task.due_date) && task.status !== 'Done';
          return (
            <div key={task.id} className="group flex items-start gap-3 px-5 py-3">
              <button
                onClick={() => onToggle(task)}
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition',
                  task.status === 'Done' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50',
                )}
                title={task.status === 'Done' ? 'Reopen task' : 'Mark complete'}
              >
                {task.status === 'Done' && <Check className="h-2.5 w-2.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[13px] leading-snug', task.status === 'Done' && 'text-muted-foreground line-through')}>{task.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">{companiesById[task.company_id]?.name || 'Internal'}</span>
                  <span>·</span>
                  <span>{task.category}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {task.status === 'Blocked' && <StatusBadge status="Blocked" />}
                <span className={cn('flex items-center gap-1 text-[10.5px]', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                  <Clock className="h-2.5 w-2.5" /> {task.status === 'Done' ? 'Done' : relative(task.due_date)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}