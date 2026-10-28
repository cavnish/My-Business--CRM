BEGIN;

ALTER TABLE public.reminder_preferences
  ADD COLUMN IF NOT EXISTS payment_reminder_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS payments_due_reminder_idx
  ON public.payments (owner_id, next_reminder)
  WHERE next_reminder IS NOT NULL
    AND is_demo = false;

INSERT INTO public.app_schema_migrations (version)
VALUES ('008_payment_reminder_notifications')
ON CONFLICT (version) DO NOTHING;

COMMIT;
