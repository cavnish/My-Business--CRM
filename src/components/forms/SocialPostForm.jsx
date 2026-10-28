import React, { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, LoaderCircle } from 'lucide-react';
import { neon } from '@/api/neonDataClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, SelectInput } from '@/components/shared/Field';
import { useToast } from '@/components/ui/use-toast';
import { PLATFORMS, POST_STATUS, POST_TYPES } from '@/lib/constants';
import { addDays, todayISO } from '@/lib/format';
import { fetchPublicSocialMetadata, parseSocialPostUrl } from '@/lib/socialPostMetadata';
import { useAuth } from '@/lib/AuthContext';

const blank = {
  company_id: '', platform: 'Instagram', title: '', campaign: '', post_type: 'Image',
  caption: '', hashtags: '', scheduled_date: '', status: 'Idea', published_url: '', media_url: '', notes: '', calendar_event_id: '',
};

export default function SocialPostForm({ open, onOpenChange, companies = [], companyId, post, onSaved }) {
  const [form, setForm] = useState(blank);
  const [events, setEvents] = useState([]);
  const [eventLoadError, setEventLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [metadataMessage, setMetadataMessage] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      setForm(post ? { ...blank, ...post, calendar_event_id: post.calendar_event_id || '' } : { ...blank, company_id: companyId || companies[0]?.id || '' });
      setMetadataMessage('');
    }
  }, [open, post, companyId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setEventLoadError('');
    neon.entities.CalendarEvent.filter({ date: { $gte: todayISO(), $lte: addDays(90) } }, { sort: 'date', limit: 150 })
      .then((result) => {
        if (active) setEvents((result.items || []).filter((event) => event.status !== 'Cancelled'));
      })
      .catch((error) => {
        if (!active) return;
        setEventLoadError(error?.message || 'Upcoming events could not be loaded.');
        toast({ title: 'Could not load events for this post', description: error?.message || 'Please try again.', variant: 'destructive' });
      });
    return () => { active = false; };
  }, [open, toast]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const eligibleEvents = events.filter((event) => !event.company_id || event.company_id === form.company_id);

  const fetchDetails = async () => {
    if (!form.published_url.trim()) return;
    setFetchingDetails(true);
    setMetadataMessage('');
    try {
      const result = await fetchPublicSocialMetadata(form.published_url);
      setForm((current) => {
        const metadata = result.metadata
          ? { ...result.metadata, source_url: result.url }
          : current.source_metadata || {};
        const nextTitle = result.metadata?.title
          && (!current.title.trim() || current.title === current.source_metadata?.title)
          ? result.metadata.title
          : current.title;
        const nextCaption = result.metadata?.description
          && (!current.caption.trim() || current.caption === current.source_metadata?.description)
          ? result.metadata.description
          : current.caption;
        return {
          ...current,
          published_url: result.url,
          platform: result.platform,
          title: nextTitle,
          caption: nextCaption,
          media_url: result.metadata?.thumbnail_url || current.media_url,
          source_metadata: metadata,
        };
      });
      setMetadataMessage(result.message);
    } catch (error) {
      try {
        const parsed = parseSocialPostUrl(form.published_url);
        set('platform', parsed.platform);
        set('published_url', parsed.url);
      } catch {
        // Keep the user's text intact so they can correct the URL.
      }
      setMetadataMessage(error?.message || 'Could not retrieve public post details.');
    } finally {
      setFetchingDetails(false);
    }
  };

  const changePostUrl = (value) => {
    try {
      const parsed = parseSocialPostUrl(value);
      setForm((current) => {
        const oldMetadata = current.source_metadata || {};
        const sameSource = oldMetadata.source_url === parsed.url;
        return {
          ...current,
          published_url: value,
          platform: parsed.platform,
          source_metadata: sameSource ? oldMetadata : {},
          title: !sameSource && current.title === oldMetadata.title ? '' : current.title,
          caption: !sameSource && current.caption === oldMetadata.description ? '' : current.caption,
          media_url: !sameSource && current.media_url === oldMetadata.thumbnail_url ? '' : current.media_url,
        };
      });
    } catch {
      setForm((current) => ({ ...current, published_url: value }));
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.company_id) return;
    setSaving(true);
    try {
      const payload = { ...form, scheduled_date: form.scheduled_date || null };
      if (form.published_url.trim()) {
        const parsed = parseSocialPostUrl(form.published_url);
        payload.published_url = parsed.url;
        payload.platform = parsed.platform;
      }
      if (form.calendar_event_id) {
        const event = eligibleEvents.find((item) => item.id === form.calendar_event_id);
        if (!event) throw new Error('Choose a valid upcoming event for the selected company.');
        payload.calendar_event_id = event.id;
        payload.scheduled_date = payload.scheduled_date || event.date;
      } else {
        payload.calendar_event_id = null;
      }
      if (post) await neon.entities.SocialPost.update(post.id, payload);
      else await neon.entities.SocialPost.create(payload);
      onOpenChange(false);
      onSaved?.();
      if (payload.calendar_event_id) {
        try {
          const linked = await neon.entities.Task.filter({
            company_id: payload.company_id,
            calendar_event_id: payload.calendar_event_id,
          }, { limit: 100 });
          for (const task of linked.items || []) {
            if (task.status === 'Done' || task.status === 'Awaiting Approval') continue;
            await neon.entities.Task.update(task.id, user?.role === 'admin'
              ? { status: 'Done', completed_date: todayISO() }
              : { status: 'Awaiting Approval' });
          }
        } catch (error) {
          toast({ title: 'Post saved; greeting task needs an update', description: error?.message || 'Mark its related task done after review.', variant: 'destructive' });
        }
      }
    } catch (error) {
      toast({ title: 'Could not save post', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{post ? 'Edit content' : 'Plan a post'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company"><SelectInput value={form.company_id} onChange={(v) => set('company_id', v)} options={companies.map((c) => ({ value: c.id, label: c.name }))} allowEmpty={false} /></Field>
          <Field label="Platform"><SelectInput value={form.platform} onChange={(v) => set('platform', v)} options={PLATFORMS} allowEmpty={false} /></Field>
          <Field label="Title" className="sm:col-span-2"><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Working title for this post" /></Field>
          <Field label="Campaign"><Input value={form.campaign} onChange={(e) => set('campaign', e.target.value)} /></Field>
          <Field label="Post type"><SelectInput value={form.post_type} onChange={(v) => set('post_type', v)} options={POST_TYPES} allowEmpty={false} /></Field>
          <Field label="Caption" className="sm:col-span-2"><Textarea rows={4} value={form.caption} onChange={(e) => set('caption', e.target.value)} /></Field>
          <Field label="Hashtags"><Input value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#brand #campaign" /></Field>
          <Field label="Scheduled date"><Input type="date" value={form.scheduled_date || ''} onChange={(e) => set('scheduled_date', e.target.value)} /></Field>
          <Field label="Status"><SelectInput value={form.status} onChange={(v) => set('status', v)} options={POST_STATUS} allowEmpty={false} /></Field>
          <Field label="Special day / event" hint="Link the post to a calendar event so its greeting task and reminder stay in sync." className="sm:col-span-2">
            <SelectInput
              value={form.calendar_event_id || ''}
              onChange={(value) => {
                const event = eligibleEvents.find((item) => item.id === value);
                setForm((current) => ({
                  ...current,
                  calendar_event_id: value,
                  scheduled_date: event?.date || current.scheduled_date,
                  campaign: event?.title || current.campaign,
                  title: event && !current.title.trim() ? `Greeting post: ${event.title}` : current.title,
                }));
              }}
              options={eligibleEvents.map((event) => ({ value: event.id, label: `${event.title} · ${event.date}` }))}
              placeholder="No event linked"
            />
            {eventLoadError && <p role="alert" className="mt-1 text-[10px] text-destructive">{eventLoadError}</p>}
          </Field>
          <Field label="Media URL" hint="A link to the image or video for this post."><Input value={form.media_url} onChange={(e) => set('media_url', e.target.value)} /></Field>
          <Field label="Post URL" hint="Paste a public post URL. Public metadata availability depends on the platform." className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                type="url"
                value={form.published_url}
                onChange={(e) => changePostUrl(e.target.value)}
                onBlur={() => {
                  if (form.published_url.trim() && form.source_metadata?.source_url !== form.published_url) fetchDetails();
                }}
                placeholder="https://…"
              />
              <Button type="button" variant="outline" onClick={fetchDetails} disabled={fetchingDetails || !form.published_url.trim()} className="shrink-0">
                {fetchingDetails ? <LoaderCircle className="animate-spin" /> : <ExternalLink />}
                <span className="hidden sm:inline">{fetchingDetails ? 'Fetching…' : 'Fetch details'}</span>
              </Button>
            </div>
            {metadataMessage && <p role="status" className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{metadataMessage}</p>}
            {form.source_metadata?.source_url && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 p-2">
                {form.source_metadata.thumbnail_url && <img src={form.source_metadata.thumbnail_url} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />}
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">{form.source_metadata.author_name || form.source_metadata.provider_name || form.platform}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{form.source_metadata.title || 'Public post preview'}</p>
                  {form.source_metadata.fetched_at && <p className="text-[9px] text-muted-foreground">Fetched {new Date(form.source_metadata.fetched_at).toLocaleString()}</p>}
                </div>
                <CalendarDays className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
            )}
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">To fetch public preview details, the post URL is sent to Noembed and the post’s public embed provider. Private post data and performance metrics require official platform account access.</p>
          </Field>
          <Field label="Internal notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.company_id}>{saving ? 'Saving…' : post ? 'Save changes' : 'Add to calendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}