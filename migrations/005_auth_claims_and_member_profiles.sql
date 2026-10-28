BEGIN;

CREATE OR REPLACE FUNCTION public.current_request_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_id'
    ),
    ''
  )::uuid
$$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text;

CREATE OR REPLACE FUNCTION public.sync_workspace_member_profile_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.workspace_members
  SET full_name = NEW.full_name,
      updated_date = now()
  WHERE user_id = NEW.id
    AND full_name IS DISTINCT FROM NEW.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_sync_workspace_member_name ON public.user_profiles;
CREATE TRIGGER user_profiles_sync_workspace_member_name
  AFTER INSERT OR UPDATE OF full_name ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_workspace_member_profile_name();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_avatar_url_size_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_avatar_url_size_check
      CHECK (avatar_url IS NULL OR length(avatar_url) <= 500000);
  END IF;
END;
$$;

DROP POLICY IF EXISTS workspace_profile_read ON public.user_profiles;
CREATE POLICY workspace_profile_read ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = public.current_request_user_id()
    OR (
      public.is_workspace_admin()
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members AS member
        WHERE member.user_id = user_profiles.id
          AND member.workspace_owner_id = public.current_workspace_owner_id()
      )
    )
  );

DROP POLICY IF EXISTS workspace_profile_insert ON public.user_profiles;
CREATE POLICY workspace_profile_insert ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (id = public.current_request_user_id() AND owner_id = public.current_request_user_id())
    OR (
      public.is_workspace_admin()
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members AS member
        WHERE member.user_id = user_profiles.id
          AND member.workspace_owner_id = public.current_workspace_owner_id()
      )
    )
  );

DROP POLICY IF EXISTS workspace_profile_update ON public.user_profiles;
CREATE POLICY workspace_profile_update ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    id = public.current_request_user_id()
    OR (
      public.is_workspace_admin()
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members AS member
        WHERE member.user_id = user_profiles.id
          AND member.workspace_owner_id = public.current_workspace_owner_id()
      )
    )
  )
  WITH CHECK (
    id = public.current_request_user_id()
    OR (
      public.is_workspace_admin()
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members AS member
        WHERE member.user_id = user_profiles.id
          AND member.workspace_owner_id = public.current_workspace_owner_id()
      )
    )
  );

COMMIT;
