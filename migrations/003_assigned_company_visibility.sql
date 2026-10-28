BEGIN;

DROP POLICY IF EXISTS workspace_company_read ON public.companies;
CREATE POLICY workspace_company_read ON public.companies
  FOR SELECT TO authenticated
  USING (
    owner_id = public.current_workspace_owner_id()
    AND (
      public.is_workspace_admin()
      OR EXISTS (
        SELECT 1
        FROM public.tasks AS assigned_task
        WHERE assigned_task.owner_id = companies.owner_id
          AND assigned_task.company_id = companies.id
          AND assigned_task.assignee_id = auth.user_id()::uuid
      )
      OR EXISTS (
        SELECT 1
        FROM public.projects AS assigned_project
        WHERE assigned_project.owner_id = companies.owner_id
          AND assigned_project.company_id = companies.id
          AND assigned_project.assignee_id = auth.user_id()::uuid
      )
    )
  );

INSERT INTO public.app_schema_migrations (version)
VALUES ('003_assigned_company_visibility')
ON CONFLICT (version) DO NOTHING;

COMMIT;
