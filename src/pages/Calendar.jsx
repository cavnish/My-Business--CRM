import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, RefreshCw, ListPlus } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import EventForm from '@/components/forms/EventForm';
import CalendarDayPanel from '@/components/calendar/CalendarDayPanel';
import { EVENT_CATEGORIES } from '@/lib/constants';
import { addDays, effectivePaymentStatus, fmtDate, isOpenInvoice, relative, todayISO } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { calendarRefreshDue, endOfWeekISO, eventPostTaskDueDate, eventPostTaskSeed, eventPostTaskTitle, fetchIndiaPublicHolidays, fetchWikimediaOnThisDay, globalObservancesForYear, isPostWorthyEvent, markCalendarRefreshed, startOfWeekISO } from '@/lib/calendarSources';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [posts, setPosts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [companyId, setCompanyId] = useState('all');
  const [category, setCategory] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [editing, setEditing] = useState(null);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [dayFactsLoading, setDayFactsLoading] = useState(false);
  const [dayFactsError, setDayFactsError] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const taskGenerationInFlight = useRef(false);
  const { toast } = useToast();

  const load = async (year = cursor.getFullYear()) => {
    try {
      const [eventRes, taskRes, postRes, payRes, projectRes, companyRes] = await Promise.all([
        neon.entities.CalendarEvent.filter({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }, { sort: 'date', limit: 3000 }),
        neon.entities.Task.filter({}, { limit: 500 }),
        neon.entities.SocialPost.filter({}, { limit: 200 }),
        neon.entities.Payment.filter({}, { limit: 200 }),
        neon.entities.Project.filter({}, { limit: 200 }),
        neon.entities.Company.list({ limit: 60 }),
      ]);
      setEvents(eventRes.items || []);
      setEventsLoaded(true);
      setTasks(taskRes.items || []);
      setPosts(postRes.items || []);
      setPayments(payRes.items || []);
      setProjects(projectRes.items || []);
      setCompanies(companyRes.items || []);
    } catch (error) {
      toast({ title: 'Could not load calendar', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  useEffect(() => { load(); }, [cursor]);

  const refreshObservances = async ({ automatic = false, currentEvents = events } = {}) => {
    setRefreshing(true);
    try {
      const currentYear = cursor.getFullYear();
      const holidayResults = await Promise.allSettled([
        fetchIndiaPublicHolidays(currentYear),
        fetchIndiaPublicHolidays(currentYear + 1),
      ]);
      const holidays = holidayResults.flatMap((result) => (
        result.status === 'fulfilled' ? result.value : []
      ));
      const failedHolidayYears = holidayResults
        .map((result, index) => result.status === 'rejected' ? currentYear + index : null)
        .filter(Boolean);
      const incoming = [
        ...holidays,
        ...globalObservancesForYear(currentYear),
        ...globalObservancesForYear(currentYear + 1),
      ];
      const knownSeeds = new Set(currentEvents.map((event) => event.seed_key).filter(Boolean));
      const knownDatesAndNames = new Set(currentEvents.map((event) => (
        `${String(event.date).slice(0, 10)}:${String(event.title).trim().toLocaleLowerCase()}`
      )));
      const newEvents = [];
      for (const event of incoming) {
        const duplicateKey = `${event.date}:${event.title.trim().toLocaleLowerCase()}`;
        if (knownSeeds.has(event.seed_key) || knownDatesAndNames.has(duplicateKey)) continue;
        try {
          const saved = await neon.entities.CalendarEvent.create({
            title: event.title,
            date: event.date,
            category: event.category,
            region: event.region || null,
            description: event.description || null,
            source: event.source || 'manual',
            seed_key: event.seed_key || null,
            company_id: null,
            status: 'Planned',
          });
          newEvents.push(saved);
          knownSeeds.add(event.seed_key);
          knownDatesAndNames.add(duplicateKey);
        } catch (error) {
          const existing = await neon.entities.CalendarEvent.filter({ seed_key: event.seed_key }, { limit: 1 });
          if (!existing.items[0]) throw error;
          knownSeeds.add(event.seed_key);
        }
      }
      const refreshed = await neon.entities.CalendarEvent.filter({ date: { $gte: `${currentYear}-01-01`, $lte: `${currentYear + 1}-12-31` } }, { sort: 'date', limit: 3000 });
      setEvents(refreshed.items || []);
      markCalendarRefreshed();
      if (!automatic) {
        toast({
          title: 'Calendar updated',
          description: `${newEvents.length} new days added. Existing and manually edited events were kept.${failedHolidayYears.length ? ` Nager.Date could not load ${failedHolidayYears.join(', ')}.` : ''}`,
        });
      } else if (failedHolidayYears.length) {
        toast({
          title: 'Calendar holiday feed is unavailable',
          description: `Could not load Nager.Date for ${failedHolidayYears.join(', ')}. Saved events and global observances remain available.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: automatic ? 'Could not refresh calendar data' : 'Could not refresh special days',
        description: `${error?.message || 'Holiday sources are unavailable.'} Saved calendar events are still available.`,
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!eventsLoaded || !calendarRefreshDue()) return;
    refreshObservances({ automatic: true, currentEvents: events });
  }, [events, eventsLoaded]);

  const saveImportedEvents = async (incoming, { force = false } = {}) => {
    const existingBySeed = new Map(events.filter((event) => event.seed_key).map((event) => [event.seed_key, event]));
    const saved = [];
    for (const event of incoming) {
      const existing = existingBySeed.get(event.seed_key);
      if (existing && !force) {
        saved.push(existing);
        continue;
      }
      const payload = {
        title: event.title,
        date: event.date,
        category: event.category || 'Custom event',
        region: event.region || null,
        company_id: null,
        description: event.description || null,
        status: 'Planned',
        source: event.source || 'manual',
        source_url: event.source_url || null,
        source_attribution: event.source_attribution || null,
        verification_status: event.verification_status || 'Curated',
        historical_year: event.historical_year || null,
        location: event.location || null,
        person_name: event.person_name || null,
        religion: event.religion || null,
        historical_period: event.historical_period || null,
        country_code: event.country_code || null,
        source_metadata: event.source_metadata || {},
        greeting_suitable: Boolean(event.greeting_suitable),
        seed_key: event.seed_key || null,
      };
      try {
        const result = existing ? await neon.entities.CalendarEvent.update(existing.id, payload) : await neon.entities.CalendarEvent.create(payload);
        existingBySeed.set(event.seed_key, result);
        saved.push(result);
      } catch (error) {
        const duplicate = event.seed_key ? await neon.entities.CalendarEvent.filter({ seed_key: event.seed_key }, { limit: 1 }) : { items: [] };
        if (!duplicate.items[0]) throw error;
        saved.push(duplicate.items[0]);
      }
    }
    return saved;
  };

  const refreshDayFacts = async (date = selectedDate, { force = true } = {}) => {
    setDayFactsLoading(true);
    setDayFactsError('');
    try {
      const cached = events.filter((event) => event.date === date && event.source === 'wikimedia-on-this-day');
      if (cached.length && !force) return;
      const imported = await fetchWikimediaOnThisDay(date, AbortSignal.timeout(15000));
      await saveImportedEvents(imported, { force });
      await load(new Date(`${date}T12:00:00`).getFullYear());
      if (!imported.length) setDayFactsError('No Wikimedia facts were returned for this date. Your custom and saved events are still available.');
    } catch (error) {
      setDayFactsError(error?.message || 'Historical facts could not be refreshed. Saved events are still available.');
    } finally {
      setDayFactsLoading(false);
    }
  };

  const generateEventPostTasks = async ({ automatic = false } = {}) => {
    if (taskGenerationInFlight.current) return;
    taskGenerationInFlight.current = true;
    setGeneratingTasks(true);
    try {
      const from = todayISO();
      const through = addDays(30);
      const targets = events.filter((event) => (
        event.status !== 'Cancelled'
        &&
        isPostWorthyEvent(event)
        && event.date >= from
        && event.date <= through
      ));
      if (!targets.length || !companies.length) {
        if (!automatic) {
          toast({ title: 'No greeting tasks to create', description: 'Add companies and upcoming festivals or observances first.' });
        }
        return;
      }
      const existing = await neon.entities.Task.filter(
        { seed_key: { $regex: 'calendar-event-post:' } },
        { limit: 3000 },
      );
      const existingSeeds = new Set((existing.items || []).map((task) => task.seed_key));
      let created = 0;
      for (const event of targets) {
        const targetCompanies = event.company_id
          ? companies.filter((company) => company.id === event.company_id)
          : companies;
        for (const company of targetCompanies) {
          const seed_key = eventPostTaskSeed(event, company.id);
          if (existingSeeds.has(seed_key)) continue;
          try {
            await neon.entities.Task.create({
              company_id: company.id,
              calendar_event_id: event.id,
              title: eventPostTaskTitle(event.title),
              description: `Create a greeting post for ${event.title} by ${fmtDate(event.date)}.`,
              category: 'Social Media',
              priority: 'Medium',
              status: 'To Do',
              due_date: eventPostTaskDueDate(event.date),
              notes: `Generated from calendar event ${event.id}. Link the post and mark this task done when ready.`,
              seed_key,
            });
            created += 1;
            existingSeeds.add(seed_key);
          } catch (error) {
            const duplicate = await neon.entities.Task.filter({ seed_key }, { limit: 1 });
            if (!duplicate.items[0]) throw error;
            existingSeeds.add(seed_key);
          }
        }
      }
      const taskResult = await neon.entities.Task.filter({}, { limit: 1000 });
      setTasks(taskResult.items || []);
      if (!automatic) {
        toast({
          title: created ? 'Greeting tasks created' : 'Greeting tasks are up to date',
          description: created ? `${created} tasks were added across companies for events in the next 30 days.` : 'No duplicate tasks were created.',
        });
      }
    } catch (error) {
      if (!automatic) {
        toast({ title: 'Could not generate greeting tasks', description: error?.message || 'Please try again.', variant: 'destructive' });
      } else {
        console.error('Automatic event greeting task generation failed:', error);
      }
    } finally {
      taskGenerationInFlight.current = false;
      setGeneratingTasks(false);
    }
  };

  useEffect(() => {
    if (eventsLoaded && events.length && companies.length) {
      generateEventPostTasks({ automatic: true });
    }
  }, [events, eventsLoaded, companies]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const inScope = (record) => companyId === 'all' || record.company_id === companyId || !record.company_id;

  const filteredEvents = useMemo(() => events.filter((event) => {
    if (event.hidden || event.status === 'Cancelled') return false;
    if (!inScope(event)) return false;
    if (category !== 'all' && event.category !== category) return false;
    if (scope === 'india' && event.country_code !== 'IN' && event.region !== 'India') return false;
    if (scope === 'maharashtra' && !/maharashtra/i.test(`${event.region || ''} ${event.location || ''}`)) return false;
    if (scope === 'worldwide' && event.region !== 'Worldwide') return false;
    if (scope === 'festival' && !['Festival', 'Cultural heritage'].includes(event.category)) return false;
    if (scope === 'birth' && event.category !== 'Birth anniversary') return false;
    if (scope === 'death' && event.category !== 'Death anniversary') return false;
    if (scope === 'history' && !['Historical event', 'Invention or discovery'].includes(event.category)) return false;
    if (scope === 'awareness' && !['Awareness day', 'Global observance', 'International observance'].includes(event.category)) return false;
    if (scope === 'holiday' && !['Official holiday', 'Indian national day'].includes(event.category)) return false;
    const needle = search.trim().toLowerCase();
    return !needle || [event.title, event.description, event.person_name, event.location, event.region, event.category, event.religion, event.historical_period]
      .some((value) => String(value || '').toLowerCase().includes(needle));
  }), [events, companyId, category, scope, search]);

  const dayItems = useMemo(() => {
    const map = {};
    const push = (date, item) => {
      if (!date) return;
      const key = String(date).slice(0, 10);
      map[key] = map[key] || [];
      map[key].push(item);
    };
    filteredEvents.forEach((e) => push(e.date, { id: e.id, label: e.title, type: 'event', category: e.category, record: e }));
    if (category === 'all') {
      tasks.filter((t) => inScope(t) && t.status !== 'Done').forEach((t) => push(t.due_date, { id: t.id, label: t.title, type: 'task', meta: companiesById[t.company_id]?.name }));
      posts.filter((p) => inScope(p) && p.scheduled_date && p.status !== 'Published').forEach((p) => push(p.scheduled_date, { id: p.id, label: p.title, type: 'social', meta: p.platform }));
      projects.filter((p) => inScope(p) && p.deadline && !['Completed', 'Cancelled'].includes(p.status)).forEach((p) => push(p.deadline, { id: p.id, label: `${p.name} due`, type: 'project', meta: companiesById[p.company_id]?.name }));
      payments.filter((p) => inScope(p) && p.due_date && isOpenInvoice(p)).forEach((p) => push(p.due_date, { id: `due-${p.id}`, label: `Invoice due: ${p.invoice_no || p.title}`, type: 'payment' }));
      payments.filter((p) => inScope(p) && p.next_reminder && isOpenInvoice(p) && ['Pending', 'Partially Paid', 'Overdue'].includes(effectivePaymentStatus(p))).forEach((p) => push(p.next_reminder, { id: `reminder-${p.id}`, label: `Follow up: ${p.invoice_no || p.title}`, type: 'payment' }));
    }
    return map;
  }, [filteredEvents, tasks, posts, payments, projects, companyId, category, companiesById]);

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
  const upcoming = filteredEvents
    .filter((e) => e.date >= today && e.date <= addDays(30))
    .sort((a, b) => a.date.localeCompare(b.date));
  const todaysSpecialDays = filteredEvents.filter((event) => event.date === today);
  const weekStart = startOfWeekISO(today);
  const weekEnd = endOfWeekISO(today);
  const thisWeeksSpecialDays = filteredEvents
    .filter((event) => isPostWorthyEvent(event) && event.date >= weekStart && event.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  const move = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const openDay = (date) => {
    setSelectedDate(date);
    setDayPanelOpen(true);
    setDayFactsError('');
    refreshDayFacts(date, { force: false });
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Planning"
        title="Calendar"
        description="Festivals, observances, client dates and the work you have promised — side by side."
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => refreshObservances()} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing…' : 'Refresh special days'}
            </button>
            <button type="button" onClick={() => generateEventPostTasks()} disabled={generatingTasks} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium disabled:opacity-60">
              <ListPlus className="h-3.5 w-3.5" /> {generatingTasks ? 'Checking…' : 'Refresh greeting tasks'}
            </button>
            <button onClick={() => { setEditing(null); setSelectedDate(today); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Add event</button>
          </div>
        )}
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
                            else navigate(item.type === 'task' ? '/tasks' : item.type === 'social' ? '/social' : item.type === 'project' ? `/projects/${item.id}` : '/payments');
                          }}
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[9.5px] leading-tight ${item.type === 'event' ? CHIP[item.category] || CHIP['Custom event'] : item.type === 'task' ? 'bg-[#EAF0E6] text-[#46603F]' : item.type === 'social' ? 'bg-[#F7EBDC] text-[#8A6027]' : item.type === 'project' ? 'bg-[#E7EEF4] text-[#35586E]' : 'bg-[#EDE7F1] text-[#5F4B72]'}`}
                        >
                          {item.type === 'event' ? item.label : `${item.type === 'task' ? 'Task' : item.type === 'social' ? 'Post' : item.type === 'project' ? 'Project' : 'Payment'}: ${item.label}`}
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
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#E7EEF4]" /> Project deadline</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#EDE7F1]" /> Invoice & follow-up</span>
            <span className="ml-auto">Click any day to add an event.</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[12.5px] font-medium">This week · greeting posts</h2>
              <span className="text-[10px] text-muted-foreground">{fmtDate(weekStart, { year: false })} – {fmtDate(weekEnd, { year: false })}</span>
            </div>
            <div className="mt-2 space-y-2">
              {thisWeeksSpecialDays.length === 0 && <p className="text-[11px] text-muted-foreground">No special-day greeting posts due this week.</p>}
              {thisWeeksSpecialDays.map((event) => {
                const eventTasks = tasks.filter((task) => task.calendar_event_id === event.id);
                const pending = eventTasks.filter((task) => task.status !== 'Done').length;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => navigate('/tasks?view=This%20week')}
                    className="block w-full rounded-lg border border-border/70 px-2.5 py-2 text-left transition hover:bg-muted/40"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11.5px] font-medium">Greeting post: {event.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(event.date, { year: false })}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {eventTasks.length === 0 ? 'Preparing tasks…' : pending === 0 ? 'All companies done' : `${pending} company task${pending === 1 ? '' : 's'} open · due on event day`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-[#C98B54]" />
              <h2 className="text-[12.5px] font-medium">Today’s special days</h2>
            </div>
            <div className="mt-2 space-y-2">
              {todaysSpecialDays.length === 0 && <p className="text-[11px] text-muted-foreground">No saved special days today.</p>}
              {todaysSpecialDays.map((event) => (
                <button key={event.id} onClick={() => { setEditing(event); setSelectedDate(event.date); setFormOpen(true); }} className="block w-full text-left">
                  <p className="text-[11.5px] font-medium">{event.title}</p>
                  <p className="text-[10px] text-muted-foreground">{event.category} · {event.region || 'Worldwide'}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-[#C98B54]" />
              <h2 className="text-[12.5px] font-medium">Coming up · 30 days</h2>
            </div>
            <div className="mt-3 max-h-[440px] space-y-2.5 overflow-y-auto pr-1">
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
