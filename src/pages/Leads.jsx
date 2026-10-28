import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Search, Download, LayoutGrid, List, Users } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import DeleteButton from '@/components/shared/DeleteButton';
import LeadForm from '@/components/forms/LeadForm';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/components/ui/use-toast';
import useNewQuery from '@/hooks/useNewQuery';
import { downloadCsv } from '@/lib/exportCsv';
import { LEAD_STAGES } from '@/lib/constants';
import { fmtDate, inr, isOverdue, relative, todayISO } from '@/lib/format';

const OPEN_STAGES = LEAD_STAGES.filter((s) => !['Won', 'Lost'].includes(s));

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('board');
  const [formOpen, setFormOpen] = useNewQuery();
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    const query = {};
    if (companyId !== 'all') query.company_id = companyId;
    if (search.trim()) query.name = { $regex: search.trim() };
    try {
      const [leadRes, companyRes] = await Promise.all([
        neon.entities.Lead.filter(query, { sort: '-created_date', limit: 300 }),
        neon.entities.Company.list({ limit: 60 }),
      ]);
      setLeads(leadRes.items || []);
      setCompanies(companyRes.items || []);
    } catch (error) {
      toast({ title: 'Could not load leads', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [companyId, search]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const open = leads.filter((l) => !['Won', 'Lost'].includes(l.status));
  const pipeline = open.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
  const won = leads.filter((l) => l.status === 'Won');
  const overdue = open.filter((l) => l.next_follow_up && isOverdue(l.next_follow_up));

  const moveLead = async (lead, status) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    try {
      await neon.entities.Lead.update(lead.id, { status, last_contact: todayISO() });
    } catch (error) {
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? lead : item)));
      toast({ title: 'Could not update lead', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const lead = leads.find((l) => l.id === result.draggableId);
    if (!lead || lead.status === result.destination.droppableId) return;
    moveLead(lead, result.destination.droppableId);
  };

  const exportLeads = () => {
    downloadCsv(`leads-${todayISO()}.csv`, leads, [
      { label: 'Name', key: 'name' },
      { label: 'Company', key: 'company_name' },
      { label: 'Client workspace', value: (r) => companiesById[r.company_id]?.name || '' },
      { label: 'Phone', key: 'phone' },
      { label: 'Email', key: 'email' },
      { label: 'Source', key: 'source' },
      { label: 'Requirement', key: 'service' },
      { label: 'Stage', key: 'status' },
      { label: 'Value', key: 'estimated_value' },
      { label: 'Next follow-up', key: 'next_follow_up' },
      { label: 'Notes', key: 'notes' },
    ]);
  };

  const openEdit = (lead) => { setEditing(lead); setFormOpen(true); };
  const addLead = () => { setEditing(null); setFormOpen(true); };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description="A single pipeline for every company — drag a card to move the conversation forward."
        actions={
          <>
            <button onClick={exportLeads} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button onClick={addLead} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">
              <Plus className="h-3.5 w-3.5" /> Add lead
            </button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Open leads', open.length],
          ['Pipeline value', inr(pipeline, true)],
          ['Won', won.length],
          ['Overdue follow-ups', overdue.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className={`num mt-1 text-[17px] font-medium ${label === 'Overdue follow-ups' && Number(value) > 0 ? 'text-destructive' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-[12.5px] outline-none focus:border-ring" />
        </div>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-[12px]">
          <option value="all">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          <button onClick={() => setView('board')} className={`rounded-md p-1.5 ${view === 'board' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`} title="Board"><LayoutGrid className="h-3.5 w-3.5" /></button>
          <button onClick={() => setView('list')} className={`rounded-md p-1.5 ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`} title="List"><List className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card/60" />
      ) : leads.length === 0 ? (
        <EmptyState icon={Users} title="No leads yet" description="Add a lead manually, or filter to a company and add the first enquiry." action={<button onClick={addLead} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Add a lead</button>} />
      ) : view === 'board' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="scroll-thin -mx-1 flex gap-2.5 overflow-x-auto pb-3">
            {LEAD_STAGES.map((stage) => {
              const stageLeads = leads.filter((l) => l.status === stage);
              const value = stageLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
              return (
                <div key={stage} className="w-[236px] shrink-0 rounded-2xl border border-border bg-[#F6F3EC]/70">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] font-medium">{stage}</span>
                      <span className="rounded-full bg-card px-1.5 text-[10px] text-muted-foreground">{stageLeads.length}</span>
                    </div>
                    <span className="num text-[10px] text-muted-foreground">{inr(value, true)}</span>
                  </div>
                  <Droppable droppableId={stage}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-[120px] space-y-2 px-2 pb-2 transition ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}>
                        {stageLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(16,32,28,0.04)] transition ${dragSnapshot.isDragging ? 'rotate-1 shadow-lg' : ''}`}
                                onClick={() => openEdit(lead)}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-[12px] font-medium leading-snug">{lead.name}</p>
                                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${lead.priority === 'High' ? 'bg-rose-500' : lead.priority === 'Low' ? 'bg-slate-300' : 'bg-amber-400'}`} />
                                </div>
                                <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{lead.company_name || companiesById[lead.company_id]?.name}</p>
                                {lead.service && <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground/90">{lead.service}</p>}
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="num text-[11px] font-medium">{inr(lead.estimated_value, true)}</span>
                                  {lead.next_follow_up && (
                                    <span className={`text-[10px] ${isOverdue(lead.next_follow_up) && !['Won', 'Lost'].includes(lead.status) ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                                      {relative(lead.next_follow_up)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 font-medium">Company</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Value</th>
                  <th className="px-3 py-2.5 font-medium">Follow-up</th>
                  <th className="px-3 py-2.5 font-medium">Stage</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {leads.map((l) => (
                  <tr key={l.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(l)}>
                    <td className="px-4 py-2.5">
                      <p className="text-[12.5px] font-medium">{l.name}</p>
                      <p className="text-[10.5px] text-muted-foreground">{l.company_name || l.location || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-muted-foreground">{companiesById[l.company_id]?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-[11.5px] text-muted-foreground">{l.source}</td>
                    <td className="num px-3 py-2.5 text-[12px]">{inr(l.estimated_value)}</td>
                    <td className="px-3 py-2.5 text-[11.5px] text-muted-foreground">{fmtDate(l.next_follow_up, { year: false })}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <DeleteButton onConfirm={async () => { await neon.entities.Lead.delete(l.id); load(); }} label="lead" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeadForm open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }} companies={companies} companyId={companyId !== 'all' ? companyId : ''} lead={editing} onSaved={load} />
    </div>
  );
}