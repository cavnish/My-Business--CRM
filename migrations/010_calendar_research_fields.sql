BEGIN;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_attribution text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'Manual',
  ADD COLUMN IF NOT EXISTS historical_year integer,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS person_name text,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS historical_period text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_attribution text,
  ADD COLUMN IF NOT EXISTS greeting_suitable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS calendar_events_owner_date_idx
  ON public.calendar_events (owner_id, date);

CREATE INDEX IF NOT EXISTS calendar_events_owner_category_idx
  ON public.calendar_events (owner_id, category)
  WHERE hidden = false;

INSERT INTO public.app_schema_migrations (version)
VALUES ('010_calendar_research_fields')
ON CONFLICT (version) DO NOTHING;

COMMIT;
