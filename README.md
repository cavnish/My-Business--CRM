# Webofolio

Webofolio is a client operations workspace for managing companies, leads, projects, tasks, campaigns, payments and reports.

The application uses Neon Managed Auth and Neon PostgreSQL for its business records. The legacy Base44 database and its data have not been deleted or modified.

## Local setup

1. Install Node.js and dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and configure the Neon Auth URL, Neon Data API URL, a direct `DATABASE_URL_UNPOOLED` connection string, and the initial administrator email. Keep `.env.local` local and never commit credentials. The Data API URL may be provided as `NEON_DATA_API_URL` or `VITE_NEON_DATA_API_URL`.

3. Confirm `.neon` points to the `app-auth-dev` branch, then apply the schema migration:

   ```bash
   npm run db:migrate
   ```

   The migration command refuses to run unless the linked project and branch match this workspace's development target. It uses the direct, unpooled connection and verifies row-level security on every business table. Migration `002` uses `INITIAL_ADMIN_EMAIL` to designate the first administrator; the account matching it is approved as admin on first sign-in.

4. Start the frontend:

   ```bash
   npm run dev
   ```

   Run `npm run build`, `npm run lint`, and `npm run typecheck` for the project checks.

## Data behavior

- Sign-in uses Neon Managed Auth. The shared workspace is owned by the configured initial administrator. New accounts remain pending until an administrator approves their role. Team members can read only their assigned projects and tasks, update their task progress, and submit completion for administrator review; only an administrator can mark those tasks complete.
- Workspace roles, assignment visibility, task completion approval, and administrative CRUD are enforced by PostgreSQL RLS and database functions as well as by the UI.
- On the first authenticated visit, the app creates the four confirmed company names and website domains if they are missing. Unknown profile, technical, commercial, and contact details remain marked `To Confirm`.
- Clearly labeled `DEMO` records are provided for leads, projects, tasks, payments, SEO, social planning, project templates, and recurring schedules. Demo schedules are disabled, demo projects are Planned, demo tasks are not completed, and demo payment rows are excluded from actual invoice/payment totals.
- Historical agreements and actual payment transactions have separate tables. Secret values are not stored in ordinary application tables; credential records contain references only.
- Automated email, scheduled reminders, and social publishing stay disabled until configured. Actual receipts are recorded only after a user action and are stored in the separate transaction ledger.
- Calendar visits check Nager.Date for Indian public holidays once per local day, with a manual refresh option; imported dates and curated global observances are saved as calendar events. The dashboard derives event reminders for two days before each date. Post-planning tasks are created only when requested and use stable keys to avoid duplicates.
- Social post links can import public embed metadata where the provider allows it. Fetching sends the URL to Noembed and the post's public embed provider; private content, captions, and performance metrics may not be available without platform authorization.
- Invoices support saved, editable line items for recurring fees, website setup, and extra work. Website fees remain unbilled until explicitly added to an invoice, and collection is tracked through recorded receipts rather than assumed from the fee reference.

## Legacy data migration

Historical Base44 records have not yet been imported: this workspace has no linked Base44 app credentials or export file. The Base44 database and its existing data remain untouched. Before considering cutover, provide a Base44 JSON/CSV export (including entity IDs and relationships) so it can be imported and verified without duplicates. Do not delete the old database until that verification is complete.
