import React from 'react';
import { Check, Pencil, Clock, Ban } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import DeleteButton from '@/components/shared/DeleteButton';
import { isOverdue, relative } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function TaskRow({ task, companyName, onToggle, onEdit, onDelete, onStatusChange, canManage = true }) {
  const overdue = task.status !== 'Done' && isOverdue(task.due_date);
  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition hover:bg-muted/25">
      {canManage ? <button
        onClick={() => onToggle(task)}
        className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition', task.status === 'Done' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/60')}
        title={task.status === 'Done' ? 'Reopen' : 'Mark done'}
      >
        {task.status === 'Done' && <Check className="h-2.5 w-2.5" />}
      </button> : <select
        aria-label={`Update status for ${task.title}`}
        value={task.status}
        onChange={(event) => onStatusChange(task, event.target.value)}
        disabled={task.status === 'Done' || task.status === 'Awaiting Approval'}
        className="max-w-32 rounded-md border border-input bg-card px-2 py-1 text-[10px] disabled:opacity-70"
      >
        {['To Do', 'In Progress', 'Blocked', 'Awaiting Approval'].map((status) => <option key={status} value={status}>{status}</option>)}
      </select>}

      <button onClick={() => onEdit(task)} className="min-w-0 flex-1 text-left">
        <p className={cn('truncate text-[12.5px] leading-snug', task.status === 'Done' && 'text-muted-foreground line-through')}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="font-medium text-foreground/65">{companyName || 'Internal'}</span>
          <span>·</span>
          <span>{task.category}</span>
          {task.estimate_hours > 0 && <><span>·</span><span>{task.estimate_hours}h</span></>}
        </div>
      </button>

      <span className={cn('hidden w-20 shrink-0 items-center justify-end gap-1 text-[10.5px] sm:flex', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
        {task.status === 'Blocked' ? <Ban className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
        {task.status === 'Done' ? 'Done' : relative(task.due_date)}
      </span>

      <span className={cn('hidden h-1.5 w-1.5 shrink-0 rounded-full md:block', task.priority === 'High' ? 'bg-rose-500' : task.priority === 'Low' ? 'bg-slate-300' : 'bg-amber-400')} />
      <StatusBadge status={task.status} className="hidden sm:inline-flex" />

      {canManage && <div className="flex shrink-0 items-center">
        <button onClick={() => onEdit(task)} className="rounded-md p-1.5 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
        <DeleteButton onConfirm={() => onDelete(task)} label="task" />
      </div>}
    </div>
  );
}