BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  initial_admin_email text NOT NULL,
  workspace_owner_id uuid,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.workspace_settings (singleton, initial_admin_email)
VALUES (true, lower(trim(__INITIAL_ADMIN_EMAIL__)))
ON CONFLICT (singleton) DO UPDATE
SET initial_admin_email = EXCLUDED.initial_admin_email,
    updated_date = now();

CREATE TABLE IF NOT EXISTS public.workspace_members (
  user_id uuid PRIMARY KEY,
  workspace_owner_id uuid,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'team_member'
    CHECK (role IN ('admin', 'team_member')),
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_status_idx
  ON public.workspace_members (workspace_owner_id, approval_status, created_date);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS assignee_id uuid;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_requested_by uuid,
  ADD COLUMN IF NOT EXISTS completion_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS completion_review_note text,
  ADD COLUMN IF NOT EXISTS completion_previous_status text;

CREATE INDEX IF NOT EXISTS projects_workspace_assignee_idx
  ON public.projects (owner_id, assignee_id);

CREATE INDEX IF NOT EXISTS tasks_workspace_assignee_status_idx
  ON public.tasks (owner_id, assignee_id, status);

CREATE OR REPLACE FUNCTION public.current_workspace_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT workspace_owner_id
  FROM public.workspace_members
  WHERE user_id = auth.user_id()::uuid
    AND approval_status = 'approved'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.workspace_members
  WHERE user_id = auth.user_id()::uuid
    AND approval_status = 'approved'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_workspace_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.ensure_workspace_membership()
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_id uuid := auth.user_id()::uuid;
  auth_email text;
  auth_name text;
  email_verified boolean;
  admin_email text;
  workspace_id uuid;
  result public.workspace_members;
BEGIN
  IF current_id IS NULL THEN
    RAISE EXCEPTION 'A signed-in user is required.';
  END IF;

  SELECT u.email, u.name, u."emailVerified"
    INTO auth_email, auth_name, email_verified
  FROM neon_auth."user" AS u
  WHERE u.id::text = current_id::text;

  IF auth_email IS NULL THEN
    RAISE EXCEPTION 'The signed-in account could not be verified.';
  END IF;

  SELECT initial_admin_email, workspace_owner_id
    INTO admin_email, workspace_id
  FROM public.workspace_settings
  WHERE singleton = true
  FOR UPDATE;

  IF lower(auth_email) = lower(admin_email) THEN
    IF email_verified IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Verify the initial administrator email before claiming the workspace.';
    END IF;

    UPDATE public.workspace_settings
    SET workspace_owner_id = current_id,
        updated_date = now()
    WHERE singleton = true
      AND (workspace_owner_id IS NULL OR workspace_owner_id = current_id);

    SELECT workspace_owner_id INTO workspace_id
    FROM public.workspace_settings
    WHERE singleton = true;

    IF workspace_id <> current_id THEN
      RAISE EXCEPTION 'The initial administrator is already assigned to another account.';
    END IF;

    INSERT INTO public.workspace_members (
      user_id, workspace_owner_id, email, full_name, role, approval_status
    )
    VALUES (current_id, current_id, auth_email, auth_name, 'admin', 'approved')
    ON CONFLICT (user_id) DO UPDATE
      SET workspace_owner_id = EXCLUDED.workspace_owner_id,
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = 'admin',
          approval_status = 'approved',
          updated_date = now();

    UPDATE public.workspace_members
    SET workspace_owner_id = current_id,
        updated_date = now()
    WHERE workspace_owner_id IS NULL
      AND user_id <> current_id;
  ELSE
    INSERT INTO public.workspace_members (
      user_id, workspace_owner_id, email, full_name, role, approval_status
    )
    VALUES (current_id, workspace_id, auth_email, auth_name, 'team_member', 'pending')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT * INTO result
  FROM public.workspace_members
  WHERE user_id = current_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_member_access(
  p_user_id uuid,
  p_role text,
  p_approval_status text
)
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  workspace_id uuid;
  result public.workspace_members;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only an administrator can manage workspace access.';
  END IF;

  IF p_role NOT IN ('admin', 'team_member')
     OR p_approval_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Choose a valid role and approval status.';
  END IF;

  workspace_id := public.current_workspace_owner_id();

  UPDATE public.workspace_members
  SET role = p_role,
      approval_status = p_approval_status,
      updated_date = now()
  WHERE user_id = p_user_id
    AND workspace_owner_id = workspace_id
    AND user_id <> auth.user_id()::uuid
  RETURNING * INTO result;

  IF result.user_id IS NULL THEN
    RAISE EXCEPTION 'Workspace member not found or cannot be changed.';
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_task_completion(
  p_task_id uuid,
  p_approved boolean,
  p_review_note text DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result public.tasks;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only an administrator can review task completion.';
  END IF;

  UPDATE public.tasks
  SET status = CASE WHEN p_approved THEN 'Done' ELSE 'In Progress' END,
      completed_date = CASE WHEN p_approved THEN current_date ELSE NULL END,
      completion_reviewed_at = now(),
      completion_reviewed_by = auth.user_id()::uuid,
      completion_review_note = NULLIF(trim(p_review_note), ''),
      completion_requested_at = CASE WHEN p_approved THEN completion_requested_at ELSE NULL END,
      completion_requested_by = CASE WHEN p_approved THEN completion_requested_by ELSE NULL END
  WHERE id = p_task_id
    AND owner_id = public.current_workspace_owner_id()
    AND status = 'Awaiting Approval'
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'This task is not awaiting completion approval.';
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_record_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  workspace_id uuid := public.current_workspace_owner_id();
BEGIN
  IF workspace_id IS NULL THEN
    RAISE EXCEPTION 'Your workspace access is not approved.';
  END IF;

  NEW.owner_id := workspace_id;

  IF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.assignee_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.workspace_members
         WHERE user_id = NEW.assignee_id
           AND workspace_owner_id = workspace_id
           AND approval_status = 'approved'
           AND role = 'team_member'
       ) AND NOT public.is_workspace_admin() THEN
      RAISE EXCEPTION 'Assign tasks only to approved team members.';
    END IF;

    IF NOT public.is_workspace_admin() AND TG_OP = 'UPDATE' THEN
      IF OLD.assignee_id IS DISTINCT FROM auth.user_id()::uuid
         OR OLD.status = 'Done' THEN
        RAISE EXCEPTION 'You can only update your own open tasks.';
      END IF;

      IF (to_jsonb(NEW) - ARRAY['status', 'notes', 'updated_date'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status', 'notes', 'updated_date']) THEN
        RAISE EXCEPTION 'Team members can update only task status and notes.';
      END IF;

      IF NEW.status NOT IN ('To Do', 'In Progress', 'Blocked', 'Awaiting Approval') THEN
        RAISE EXCEPTION 'Submit a task for review instead of marking it done.';
      END IF;

      IF NEW.status = 'Awaiting Approval' AND OLD.status <> 'Awaiting Approval' THEN
        NEW.completion_previous_status := OLD.status;
        NEW.completion_requested_at := now();
        NEW.completion_requested_by := auth.user_id()::uuid;
        NEW.completed_date := NULL;
      ELSIF OLD.status = 'Awaiting Approval' AND NEW.status <> 'Awaiting Approval' THEN
        NEW.completion_requested_at := NULL;
        NEW.completion_requested_by := NULL;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'projects' AND NEW.assignee_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.workspace_members
          WHERE user_id = NEW.assignee_id
            AND workspace_owner_id = workspace_id
            AND approval_status = 'approved'
            AND role = 'team_member'
        ) AND NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Assign projects only to approved team members.';
  ELSIF TG_TABLE_NAME = 'workspace_goals' THEN
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_goal_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  workspace_id uuid := public.current_workspace_owner_id();
BEGIN
  IF workspace_id IS NULL THEN
    RAISE EXCEPTION 'Your workspace access is not approved.';
  END IF;
  NEW.owner_id := workspace_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_user_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_workspace_admin()
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Workspace roles can only be changed by an administrator.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.workspace_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.user_id()::uuid,
  title text NOT NULL,
  description text,
  target_value numeric(14, 2) NOT NULL DEFAULT 0,
  current_value numeric(14, 2) NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'In Progress',
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_goals_owner_due_idx
  ON public.workspace_goals (owner_id, due_date);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_read ON public.workspace_members;
CREATE POLICY workspace_members_read ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.user_id()::uuid
    OR (
      public.is_workspace_admin()
      AND workspace_owner_id = public.current_workspace_owner_id()
    )
  );

DROP POLICY IF EXISTS workspace_goals_admin ON public.workspace_goals;
CREATE POLICY workspace_goals_admin ON public.workspace_goals
  FOR ALL TO authenticated
  USING (
    owner_id = public.current_workspace_owner_id()
    AND public.is_workspace_admin()
  )
  WITH CHECK (
    owner_id = public.current_workspace_owner_id()
    AND public.is_workspace_admin()
  );

DO $$
DECLARE
  table_name text;
  app_tables text[] := ARRAY[
    'leads', 'payments', 'payment_transactions', 'seo_tasks',
    'social_posts', 'calendar_events', 'notes', 'company_websites',
    'company_services', 'company_brand_profiles', 'project_templates',
    'recurring_task_schedules', 'monthly_work_plans', 'monthly_work_logs',
    'monthly_work_reports', 'commercial_agreements', 'social_workspaces',
    'integration_configurations', 'credential_references',
    'reminder_preferences', 'workspace_seed_state'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS owner_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY workspace_admin_access ON public.%I FOR ALL TO authenticated USING (owner_id = public.current_workspace_owner_id() AND public.is_workspace_admin()) WITH CHECK (owner_id = public.current_workspace_owner_id() AND public.is_workspace_admin())',
      table_name
    );
  END LOOP;

  EXECUTE 'DROP POLICY IF EXISTS owner_access ON public.companies';
  CREATE POLICY workspace_company_read ON public.companies
    FOR SELECT TO authenticated
    USING (owner_id = public.current_workspace_owner_id());
  CREATE POLICY workspace_company_admin_write ON public.companies
    FOR ALL TO authenticated
    USING (
      owner_id = public.current_workspace_owner_id()
      AND public.is_workspace_admin()
    )
    WITH CHECK (
      owner_id = public.current_workspace_owner_id()
      AND public.is_workspace_admin()
    );

  EXECUTE 'DROP POLICY IF EXISTS owner_access ON public.projects';
  CREATE POLICY workspace_project_read ON public.projects
    FOR SELECT TO authenticated
    USING (
      owner_id = public.current_workspace_owner_id()
      AND (
        public.is_workspace_admin()
        OR assignee_id = auth.user_id()::uuid
      )
    );
  CREATE POLICY workspace_project_admin_write ON public.projects
    FOR ALL TO authenticated
    USING (
      owner_id = public.current_workspace_owner_id()
      AND public.is_workspace_admin()
    )
    WITH CHECK (
      owner_id = public.current_workspace_owner_id()
      AND public.is_workspace_admin()
    );

  EXECUTE 'DROP POLICY IF EXISTS owner_access ON public.tasks';
  CREATE POLICY workspace_task_read ON public.tasks
    FOR SELECT TO authenticated
    USING (
      owner_id = public.current_workspace_owner_id()
      AND (
        public.is_workspace_admin()
        OR assignee_id = auth.user_id()::uuid
      )
    );
  CREATE POLICY workspace_task_admin_insert ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
      owner_id = public.current_workspace_owner_id()
      AND public.is_workspace_admin()
    );
  CREATE POLICY workspace_task_update ON public.tasks
    FOR UPDATE TO authenticated
    USING (
      owner_id = public.current_workspace_owner_id()
      AND (
        public.is_workspace_admin()
        OR assignee_id = auth.user_id()::uuid
      )
    )
    WITH CHECK (
      owner_id = public.current_workspace_owner_id()
      AND (
        public.is_workspace_admin()
        OR assignee_id = auth.user_id()::uuid
      )
    );
  CREATE POLICY workspace_task_admin_delete ON public.tasks
    FOR DELETE TO authenticated
    USING (
      owner_id = public.current_workspace_owner_id()
      AND public.is_workspace_admin()
    );

  EXECUTE 'DROP POLICY IF EXISTS owner_access ON public.user_profiles';
  CREATE POLICY workspace_profile_read ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
      id = auth.user_id()::uuid
      OR (
        owner_id = public.current_workspace_owner_id()
        AND public.is_workspace_admin()
      )
    );
  CREATE POLICY workspace_profile_insert ON public.user_profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.user_id()::uuid AND owner_id = auth.user_id()::uuid);
  CREATE POLICY workspace_profile_update ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (
      id = auth.user_id()::uuid
      OR (
        owner_id = public.current_workspace_owner_id()
        AND public.is_workspace_admin()
      )
    )
    WITH CHECK (
      id = auth.user_id()::uuid
      OR (
        owner_id = public.current_workspace_owner_id()
        AND public.is_workspace_admin()
      )
    );
  CREATE POLICY workspace_profile_admin_delete ON public.user_profiles
    FOR DELETE TO authenticated
    USING (
      owner_id = public.current_workspace_owner_id()
      AND public.is_workspace_admin()
    );
END;
$$;

DROP TRIGGER IF EXISTS set_workspace_record_owner_trigger ON public.projects;
CREATE TRIGGER set_workspace_record_owner_trigger
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_record_owner();

DROP TRIGGER IF EXISTS set_workspace_record_owner_trigger ON public.tasks;
CREATE TRIGGER set_workspace_record_owner_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_record_owner();

DROP TRIGGER IF EXISTS guard_user_profile_role_trigger ON public.user_profiles;
CREATE TRIGGER guard_user_profile_role_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_role();

DROP TRIGGER IF EXISTS set_updated_date_trigger ON public.workspace_members;
CREATE TRIGGER set_updated_date_trigger
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_date();

DROP TRIGGER IF EXISTS set_workspace_record_owner_trigger ON public.workspace_goals;
CREATE TRIGGER set_workspace_record_owner_trigger
  BEFORE INSERT OR UPDATE ON public.workspace_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_goal_owner();

DROP TRIGGER IF EXISTS set_updated_date_trigger ON public.workspace_goals;
CREATE TRIGGER set_updated_date_trigger
  BEFORE UPDATE ON public.workspace_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_date();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_goals TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON public.workspace_settings FROM PUBLIC, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.workspace_members FROM authenticated;
REVOKE ALL ON FUNCTION public.current_workspace_owner_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_workspace_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_workspace_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_workspace_member_access(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_task_completion(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_workspace_owner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_workspace_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_workspace_membership() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_member_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_task_completion(uuid, boolean, text) TO authenticated;

INSERT INTO public.app_schema_migrations (version)
VALUES ('002_workspace_roles_and_approvals')
ON CONFLICT (version) DO NOTHING;

COMMIT;
