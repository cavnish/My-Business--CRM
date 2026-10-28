BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass
      AND conname = 'tasks_calendar_event_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_calendar_event_id_fkey
      FOREIGN KEY (calendar_event_id)
      REFERENCES public.calendar_events (id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.social_posts'::regclass
      AND conname = 'social_posts_calendar_event_id_fkey'
  ) THEN
    ALTER TABLE public.social_posts
      ADD CONSTRAINT social_posts_calendar_event_id_fkey
      FOREIGN KEY (calendar_event_id)
      REFERENCES public.calendar_events (id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS tasks_event_greeting_reminder_idx
  ON public.tasks (owner_id, due_date, status)
  WHERE calendar_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS social_posts_calendar_event_idx
  ON public.social_posts (owner_id, company_id, calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

INSERT INTO public.app_schema_migrations (version)
VALUES ('007_event_post_reminders')
ON CONFLICT (version) DO NOTHING;

COMMIT;
