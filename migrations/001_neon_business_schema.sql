BEGIN;

CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  name text NOT NULL,
  domain text,
  industry text,
  description text,
  contact_person text,
  phone text,
  email text,
  address text,
  logo_url text,
  brand_color text,
  status text NOT NULL DEFAULT 'To Confirm',
  profile_status text NOT NULL DEFAULT 'To Confirm',
  service_package text,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  monthly_fee numeric(14, 2),
  commission_rate numeric(7, 4),
  tax_rate numeric(7, 4),
  billing_cycle text,
  contract_start date,
  payment_terms text,
  hosting_provider text,
  domain_registrar text,
  domain_expiry date,
  deployment_platform text,
  framework text,
  repository_url text,
  database_provider text,
  analytics_id text,
  admin_url text,
  website_notes text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  UNIQUE (owner_id, seed_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_owner_domain_unique
  ON public.companies (owner_id, lower(domain))
  WHERE domain IS NOT NULL AND domain <> '';

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Planned',
  priority text,
  start_date date,
  deadline date,
  owner text,
  budget numeric(14, 2),
  fee numeric(14, 2),
  progress numeric(5, 2) NOT NULL DEFAULT 0,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id, owner_id),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid,
  project_id uuid,
  title text NOT NULL,
  description text,
  category text,
  priority text,
  status text NOT NULL DEFAULT 'To Do',
  due_date date,
  start_date date,
  assigned_to text,
  estimate_hours numeric(8, 2),
  completed_date date,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id, owner_id),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, company_id, owner_id)
    REFERENCES public.projects (id, company_id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  name text NOT NULL,
  company_name text,
  phone text,
  email text,
  location text,
  source text,
  service text,
  estimated_value numeric(14, 2),
  status text NOT NULL DEFAULT 'To Confirm',
  priority text,
  owner text,
  next_follow_up date,
  last_contact date,
  expected_close date,
  lost_reason text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  invoice_no text,
  title text NOT NULL,
  kind text,
  period text,
  amount numeric(14, 2),
  tax_rate numeric(7, 4),
  discount numeric(14, 2),
  amount_received numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'To Confirm',
  invoice_date date,
  due_date date,
  payment_date date,
  method text,
  pending_reason text,
  next_reminder date,
  last_follow_up date,
  expected_payment_date date,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id, owner_id),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_company_invoice_unique
  ON public.payments (company_id, invoice_no)
  WHERE invoice_no IS NOT NULL AND invoice_no <> '';

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  invoice_id uuid,
  amount numeric(14, 2) NOT NULL,
  received_on date,
  method text,
  reference text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id, company_id, owner_id)
    REFERENCES public.payments (id, company_id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.seo_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  title text NOT NULL,
  type text,
  target_page text,
  issue text,
  priority text,
  status text NOT NULL DEFAULT 'Pending',
  due_date date,
  completed_date date,
  keyword text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  platform text,
  title text NOT NULL,
  campaign text,
  post_type text,
  caption text,
  hashtags text,
  scheduled_date date,
  status text NOT NULL DEFAULT 'Idea',
  published_url text,
  media_url text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  title text NOT NULL,
  date date NOT NULL,
  category text,
  region text,
  company_id uuid,
  description text,
  status text NOT NULL DEFAULT 'Planned',
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid,
  title text NOT NULL,
  body text,
  pinned boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT auth.user_id()::uuid,
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  role text NOT NULL DEFAULT 'user',
  full_name text,
  business_name text,
  business_tagline text,
  business_phone text,
  business_email text,
  business_address text,
  business_gstin text,
  invoice_prefix text,
  invoice_terms text,
  payment_instructions text,
  notify_tasks boolean NOT NULL DEFAULT true,
  notify_payments boolean NOT NULL DEFAULT true,
  notify_daily boolean NOT NULL DEFAULT true,
  browser_notifications boolean NOT NULL DEFAULT false,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

CREATE TABLE IF NOT EXISTS public.company_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Primary website',
  url text NOT NULL,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'To Confirm',
  hosting_provider text,
  registrar text,
  deployment_platform text,
  framework text,
  database_provider text,
  repository_url text,
  admin_url text,
  technical_notes text,
  is_primary boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  UNIQUE (company_id, domain),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.company_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'To Confirm',
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.company_brand_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  brand_name text,
  logo_url text,
  colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  typography jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_notes text,
  status text NOT NULL DEFAULT 'To Confirm',
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Planned',
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.recurring_task_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  schedule_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'To Confirm',
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.monthly_work_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  period date NOT NULL,
  title text NOT NULL,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Planned',
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  UNIQUE (company_id, period),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.monthly_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  task_id uuid,
  work_date date NOT NULL DEFAULT current_date,
  description text NOT NULL,
  hours numeric(8, 2),
  billable boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id, company_id, owner_id)
    REFERENCES public.tasks (id, company_id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.monthly_work_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  period date NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  invoice_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  UNIQUE (company_id, period),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id, company_id, owner_id)
    REFERENCES public.payments (id, company_id, owner_id)
);

CREATE TABLE IF NOT EXISTS public.commercial_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  title text NOT NULL,
  agreement_type text,
  effective_from date,
  effective_until date,
  amount numeric(14, 2),
  currency text,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'To Confirm',
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.social_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid NOT NULL,
  platform text NOT NULL,
  account_name text,
  profile_url text,
  status text NOT NULL DEFAULT 'To Confirm',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  seed_key text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, seed_key),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.integration_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'Not configured',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  credential_reference text,
  enabled boolean NOT NULL DEFAULT false,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, company_id, provider),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.credential_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid,
  provider text NOT NULL,
  secret_name text NOT NULL,
  status text NOT NULL DEFAULT 'To Confirm',
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, company_id, provider, secret_name),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.reminder_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  company_id uuid,
  daily_greeting_enabled boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  local_time time NOT NULL DEFAULT '21:00',
  email_provider text NOT NULL DEFAULT 'Resend',
  status text NOT NULL DEFAULT 'Not configured',
  recipient_email text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, company_id),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES public.companies (id, owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.workspace_seed_state (
  owner_id uuid PRIMARY KEY DEFAULT auth.user_id()::uuid,
  seed_version integer NOT NULL,
  seeded_at timestamptz NOT NULL DEFAULT now(),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_date = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
  app_tables text[] := ARRAY[
    'companies', 'projects', 'tasks', 'leads', 'payments',
    'payment_transactions', 'seo_tasks', 'social_posts',
    'calendar_events', 'notes', 'user_profiles', 'company_websites',
    'company_services', 'company_brand_profiles', 'project_templates',
    'recurring_task_schedules', 'monthly_work_plans', 'monthly_work_logs',
    'monthly_work_reports', 'commercial_agreements', 'social_workspaces',
    'integration_configurations', 'credential_references',
    'reminder_preferences', 'workspace_seed_state'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS owner_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING (owner_id = auth.user_id()::uuid) WITH CHECK (owner_id = auth.user_id()::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_date_trigger ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER set_updated_date_trigger BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_date()',
      table_name
    );
  END LOOP;
END;
$$;

GRANT USAGE ON SCHEMA public TO authenticated;

INSERT INTO public.app_schema_migrations (version)
VALUES ('001_neon_business_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
