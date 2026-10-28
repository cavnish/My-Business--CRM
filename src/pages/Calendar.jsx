import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import EventForm from '@/components/forms/EventForm';
import { EVENT_CATEGORIES } from '@/lib/constants';
import { fmtDate, relative, todayISO } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';

const CHIP = {
  Festival: 'bg-[#F6E7D8] text-[#8A5527]',
  'Indian national day': 'bg-[#E4EBDF] text-[#3E5C43]',
  'Global observance': 'bg-[#E3EAF0] text-[#35586E]',
  'Industry event': 'bg-[#ECE7F2] text-[#5A4670]',
  'Client date': 'bg-[#F2E5E3] text-[#7C4337]',
  'Company event': 'bg-[#EDE8DA] text-[#6A5B34]',
  Renewal: 'bg-[#F5E1E1] text-[#8A3A3A]',
  'Custom event': 'bg-muted text-muted-foreground',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const today = todayISO();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [posts, setPosts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('all');
  const [category, setCategory] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [eventRes, taskRes, postRes, payRes, companyRes] = await Promise.all([
        neon.entities.CalendarEvent.filter({}, { sort: 'date', limit: 400 }),
        neon.entities.Task.filter({}, { limit: 500 }),
        neon.entities.SocialPost.filter({}, { limit: 200 }),
        neon.entities.Payment.filter({}, { limit: 200 }),
        neon.entities.Company.list({ limit: 60 }),
      ]);
      setEvents(eventRes.items || []);
      setTasks(taskRes.items || []);
      setPosts(postRes.items || []);
      setPayments(payRes.items || []);
      setCompanies(companyRes.items || []);
    } catch (error) {
      toast({ title: 'Could not load calendar', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  useEffect(() => { load(); }, []);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const inScope = (record) => companyId === 'all' || record.company_id === companyId || !record.company_id;

  const dayItems = useMemo(() => {
    const map = {};
    const push = (date, item) => {
      if (!date) return;
      const key = String(date).slice(0, 10);
      map[key] = map[key] || [];
      map[key].push(item);
    };
    events.filter((e) => inScope(e) && (category === 'all' || e.category === category)).forEach((e) => push(e.date, { id: e.id, label: e.title, type: 'event', category: e.category, record: e }));
    if (category === 'all') {
      tasks.filter((t) => inScope(t) && t.status !== 'Done').forEach((t) => push(t.due_date, { id: t.id, label: t.title, type: 'task', meta: companiesById[t.company_id]?.name }));
      posts.filter((p) => inScope(p) && p.scheduled_date && p.status !== 'Published').forEach((p) => push(p.scheduled_date, { id: p.id, label: p.title, type: 'social', meta: p.platform }));
      payments.filter((p) => inScope(p) && p.next_reminder && ['Pending', 'Partially Paid', 'Overdue'].includes(p.status)).forEach((p) => push(p.next_reminder, { id: p.id, label: `Reminder: ${p.invoice_no || p.title}`, type: 'payment' }));
    }
    return map;
  }, [events, tasks, posts, payments, companyId, category, companiesById]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const start = new Date(year, month, 1);
    const startDay = start.getDay();
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(year, month, i - startDay + 1);
      cells.push(d);
    }
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const upcoming = events.filter((e) => e.date >= today && inScope(e)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);

  const move = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const addOn = (date) => { setSelectedDate(date); setEditing(null); setFormOpen(true); };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Planning"
        title="Calendar"
        description="Festivals, observances, client dates and the work you have promised — side by side."
        actions={<button onClick={() => { setEditing(null); setSelectedDate(today); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Add event</button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-md border border-border bg-card px-2 py-1.5 text-[11.5px]">Today</button>
          <button onClick={() => move(1)} className="rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
        <h2 className="ml-1 font-display text-[20px]">{monthLabel}</h2>
        <div className="ml-auto flex items-center gap-2">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-8 max-w-[170px] rounded-lg border border-input bg-card px-2 text-[11.5px]">
            <option value="all">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 max-w-[170px] rounded-lg border border-input bg-card px-2 text-[11.5px]">
            <option value="all">All categories</option>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <div className="min-w-[680px]">
            <div className="grid grid-cols-7 border-b border-border bg-[#F8F5EE]">
              {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((d, i) => {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const items = dayItems[key] || [];
                const otherMonth = d.getMonth() !== cursor.getMonth();
                const isToday = key === today;
                return (
                  <div
                    key={i}
                    onClick={() => addOn(key)}
                    className={`min-h-[96px] cursor-pointer border-b border-r border-border/70 p-1.5 transition hover:bg-[#FBF8F1] ${otherMonth ? 'bg-[#FCFAF6]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] ${isToday ? 'bg-primary font-medium text-primary-foreground' : otherMonth ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>{d.getDate()}</span>
                      {items.length > 2 && <span className="text-[9px] text-muted-foreground">+{items.length - 2}</span>}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 2).map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.type === 'event') { setEditing(item.record); setSelectedDate(key); setFormOpen(true); }
                            else navigate(item.type === 'task' ? '/tasks' : item.type === 'social' ? '/social' : '/payments');
                          }}
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[9.5px] leading-tight ${item.type === 'event' ? CHIP[item.category] || CHIP['Custom event'] : item.type === 'task' ? 'bg-[#EAF0E6] text-[#46603F]' : item.type === 'social' ? 'bg-[#F7EBDC] text-[#8A6027]' : 'bg-[#EDE7F1] text-[#5F4B72]'}`}
                        >
                          {item.type === 'event' ? item.label : `${item.type === 'task' ? 'Task' : item.type === 'social' ? 'Post' : 'Pay'}: ${item.label}`}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#EAF0E6]" /> Task</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#F7EBDC]" /> Social</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#EDE7F1]" /> Payment reminder</span>
            <span className="ml-auto">Click any day to add an event.</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-[#C98B54]" />
              <h2 className="text-[12.5px] font-medium">Coming up</h2>
            </div>
            <div className="mt-3 space-y-2.5">
              {upcoming.length === 0 && <p className="py-4 text-center text-[11.5px] text-muted-foreground">No events ahead in this filter.</p>}
              {upcoming.map((e) => (
                <button key={e.id} onClick={() => { setEditing(e); setFormOpen(true); }} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11.5px] leading-snug">{e.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{relative(e.date)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{e.category} · {fmtDate(e.date, { year: false })}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[12.5px] font-medium">Greeting planning</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Festival and observance days are listed here so you can plan greetings ahead. Drafts are created manually — nothing is published automatically.
            </p>
          </div>
        </div>
      </div>

      <EventForm open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }} companies={companies} event={editing} initialDate={selectedDate} onSaved={load} />
    </div>
  );
}