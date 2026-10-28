import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const businessTables = [
  'companies', 'projects', 'tasks', 'leads', 'payments',
  'payment_transactions', 'seo_tasks', 'social_posts',
  'calendar_events', 'notes', 'user_profiles', 'company_websites',
  'company_services', 'company_brand_profiles', 'project_templates',
  'recurring_task_schedules', 'monthly_work_plans', 'monthly_work_logs',
  'monthly_work_reports', 'commercial_agreements', 'social_workspaces',
  'integration_configurations', 'credential_references',
  'reminder_preferences', 'workspace_seed_state', 'workspace_settings',
  'workspace_members', 'workspace_goals',
];

const readLocalEnv = async () => {
  const contents = await readFile(path.join(root, '.env.local'), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
};

const branchName = (branch) => (
  typeof branch === 'string'
    ? branch
    : branch?.name || branch?.branchName || ''
);

const verifyDevTarget = async () => {
  const context = JSON.parse(await readFile(path.join(root, '.neon'), 'utf8'));
  if (context.projectId !== 'restless-paper-33122356' || branchName(context.branch) !== 'app-auth-dev') {
    throw new Error('Database migrations are restricted to the linked app-auth-dev branch.');
  }
};

const main = async () => {
  await verifyDevTarget();
  const localEnv = await readLocalEnv();
  const connectionString = process.env.DATABASE_URL_UNPOOLED || localEnv.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED is required to run schema migrations.');
  }
  const host = new URL(connectionString).hostname;
  if (host.includes('-pooler')) {
    throw new Error('Use DATABASE_URL_UNPOOLED (a direct connection) for schema migrations.');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const target = await client.query('SELECT current_database() AS database_name');
    const migrationDirectory = path.join(root, 'migrations');
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
      .sort();
    if (migrationFiles.length === 0) throw new Error('No numbered Neon migration files were found.');

    const appliedRows = await client.query(
      'SELECT version FROM public.app_schema_migrations',
    ).catch((error) => {
      if (error.code === '42P01') return { rows: [] };
      throw error;
    });
    const appliedVersions = new Set(appliedRows.rows.map((row) => row.version));

    if (!appliedVersions.has('001_neon_business_schema')) {
      const existing = await client.query(
        'SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = ANY($2::text[])',
        ['public', businessTables],
      );
      if (existing.rowCount) {
        throw new Error(
          `Untracked business tables already exist in ${target.rows[0].database_name}; inspect them before applying this migration.`,
        );
      }
    }

    for (const fileName of migrationFiles) {
      const version = fileName.replace(/\.sql$/i, '');
      if (appliedVersions.has(version)) continue;
      let migration = await readFile(path.join(migrationDirectory, fileName), 'utf8');
      if (migration.includes('__INITIAL_ADMIN_EMAIL__')) {
        const adminEmail = process.env.INITIAL_ADMIN_EMAIL || localEnv.INITIAL_ADMIN_EMAIL;
        if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
          throw new Error('Set a valid INITIAL_ADMIN_EMAIL before applying the workspace roles migration.');
        }
        const sqlEmail = `'${adminEmail.trim().toLowerCase().replace(/'/g, "''")}'`;
        migration = migration.replaceAll('__INITIAL_ADMIN_EMAIL__', sqlEmail);
      }
      await client.query(migration);
      appliedVersions.add(version);
      console.log(`Applied ${version}.`);
    }

    const verification = await client.query(
      `SELECT count(*)::int AS rls_tables
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])
         AND c.relrowsecurity`,
      [businessTables],
    );
    if (verification.rows[0].rls_tables !== businessTables.length) {
      throw new Error(
        `Migration verification failed: expected ${businessTables.length} RLS-protected tables, found ${verification.rows[0].rls_tables}.`,
      );
    }
    const receiptFunction = await client.query(
      `SELECT has_function_privilege(
         'authenticated',
         'public.record_payment_receipt(uuid,numeric,date,text,text,text,text)',
         'EXECUTE'
       ) AS available`,
    );
    if (!receiptFunction.rows[0].available) {
      throw new Error('Migration verification failed: the authenticated receipt function is unavailable.');
    }

    console.log(`Verified ${appliedVersions.size} Neon migrations on ${target.rows[0].database_name}, with RLS on ${verification.rows[0].rls_tables} business tables.`);
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error('Neon migration failed:', error.message);
  process.exitCode = 1;
});
