BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_line_items_array_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_line_items_array_check
      CHECK (jsonb_typeof(line_items) = 'array');
  END IF;
END;
$$;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.social_posts'::regclass
      AND conname = 'social_posts_source_metadata_object_check'
  ) THEN
    ALTER TABLE public.social_posts
      ADD CONSTRAINT social_posts_source_metadata_object_check
      CHECK (jsonb_typeof(source_metadata) = 'object');
  END IF;
END;
$$;

INSERT INTO public.app_schema_migrations (version)
VALUES ('006_invoice_items_and_event_sources')
ON CONFLICT (version) DO NOTHING;

COMMIT;
