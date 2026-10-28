BEGIN;

CREATE OR REPLACE FUNCTION public.current_request_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT workspace_owner_id
  FROM public.workspace_members
  WHERE user_id = public.current_request_user_id()
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
  WHERE user_id = public.current_request_user_id()
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
  current_id uuid := public.current_request_user_id();
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
  WHERE u.id = current_id;

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
    AND user_id <> public.current_request_user_id()
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
      completion_reviewed_by = public.current_request_user_id(),
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
      IF OLD.assignee_id IS DISTINCT FROM public.current_request_user_id()
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
        NEW.completion_requested_by := public.current_request_user_id();
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

REVOKE ALL ON FUNCTION public.current_request_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_request_user_id() TO authenticated;

INSERT INTO public.app_schema_migrations (version)
VALUES ('004_preserve_jwt_identity_in_definer')
ON CONFLICT (version) DO NOTHING;

COMMIT;
