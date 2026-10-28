import { getNeonAuthToken, neonAuth } from '@/api/neonAuthClient';

const entityTables = {
  Company: 'companies',
  Lead: 'leads',
  Project: 'projects',
  Task: 'tasks',
  Payment: 'payments',
  PaymentTransaction: 'payment_transactions',
  SeoTask: 'seo_tasks',
  SocialPost: 'social_posts',
  CalendarEvent: 'calendar_events',
  Note: 'notes',
  User: 'user_profiles',
  CompanyWebsite: 'company_websites',
  CompanyService: 'company_services',
  CompanyBrandProfile: 'company_brand_profiles',
  ProjectTemplate: 'project_templates',
  RecurringTaskSchedule: 'recurring_task_schedules',
  MonthlyWorkPlan: 'monthly_work_plans',
  MonthlyWorkLog: 'monthly_work_logs',
  MonthlyWorkReport: 'monthly_work_reports',
  CommercialAgreement: 'commercial_agreements',
  SocialWorkspace: 'social_workspaces',
  IntegrationConfiguration: 'integration_configurations',
  CredentialReference: 'credential_references',
  ReminderPreference: 'reminder_preferences',
  WorkspaceSeedState: 'workspace_seed_state',
  WorkspaceMember: 'workspace_members',
  WorkspaceGoal: 'workspace_goals',
};

const apiUrl = () => {
  const configuredUrl = import.meta.env.VITE_NEON_DATA_API_URL;
  if (!configuredUrl) {
    throw new Error('VITE_NEON_DATA_API_URL must be configured to use Neon business data.');
  }
  return configuredUrl.replace(/\/+$/, '');
};

const valueExpression = (value) => {
  if (value === null) return 'is.null';
  if (typeof value === 'boolean') return `eq.${value}`;
  if (typeof value === 'number') return `eq.${value}`;
  const text = String(value);
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return /[,\s():\\"]/.test(text) ? `eq."${escaped}"` : `eq.${text}`;
};

const searchExpression = (value) => {
  const escaped = String(value).replace(/[\\"]/g, '\\$&').replace(/[%*]/g, '\\$&');
  return `ilike."*${escaped}*"`;
};

const filtersToParams = (params, filters = {}) => {
  for (const [column, condition] of Object.entries(filters || {})) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(column)) {
      throw new Error(`Unsupported Neon filter field: ${column}`);
    }

    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      for (const [operator, value] of Object.entries(condition)) {
        const expressions = {
          $eq: () => valueExpression(value),
          $ne: () => `neq.${String(value).replace(/[,():\\"]/g, '\\$&')}`,
          $gte: () => `gte.${String(value).replace(/[,():\\"]/g, '\\$&')}`,
          $gt: () => `gt.${String(value).replace(/[,():\\"]/g, '\\$&')}`,
          $lte: () => `lte.${String(value).replace(/[,():\\"]/g, '\\$&')}`,
          $lt: () => `lt.${String(value).replace(/[,():\\"]/g, '\\$&')}`,
          $regex: () => searchExpression(value),
          $in: () => `in.(${value.map((item) => `"${String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`,
          $exists: () => value ? 'not.is.null' : 'is.null',
        };
        const expression = expressions[operator];
        if (!expression) throw new Error(`Unsupported Neon filter operator: ${operator}`);
        if (operator === '$in' && !Array.isArray(value)) {
          throw new Error('The $in filter requires an array value.');
        }
        params.append(column, expression());
      }
      continue;
    }

    params.append(column, valueExpression(condition));
  }
};

const buildUrl = (table, filters, options = {}, select = '*') => {
  const url = new URL(`${apiUrl()}/${table}`);
  const params = url.searchParams;
  params.set('select', select);
  filtersToParams(params, filters);

  if (options.sort) {
    const sort = String(options.sort);
    const descending = sort.startsWith('-');
    const column = descending ? sort.slice(1) : sort;
    if (!/^[a-z_][a-z0-9_]*$/i.test(column)) {
      throw new Error(`Unsupported Neon sort field: ${column}`);
    }
    params.set('order', `${column}.${descending ? 'desc' : 'asc'}`);
  }
  if (Number.isInteger(options.limit) && options.limit >= 0) params.set('limit', String(options.limit));
  if (Number.isInteger(options.skip) && options.skip > 0) params.set('offset', String(options.skip));
  return url;
};

/**
 * @param {URL} url
 * @param {{ method?: string; body?: unknown; prefer?: string }} options
 */
const request = async (url, { method = 'GET', body, prefer } = {}) => {
  const token = await getNeonAuthToken();
  if (!token) throw new Error('Sign in before accessing company data.');

  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Accept-Profile': 'public',
  });
  if (method !== 'GET' && method !== 'HEAD') headers.set('Content-Profile', 'public');
  if (prefer) headers.set('Prefer', prefer);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    headers.set('Prefer', [prefer, 'return=representation'].filter(Boolean).join(','));
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204 || method === 'HEAD') return { response, data: null };
  const responseText = await response.text();
  let data = null;
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Neon returned an unreadable response (${response.status}).`);
    }
  }
  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || `Neon request failed (${response.status}).`;
    throw new Error(message);
  }
  return { response, data };
};

const entityClient = (entityName) => {
  const table = entityTables[entityName];
  if (!table) throw new Error(`Unknown Neon entity: ${entityName}`);

  return {
    async list(options = {}) {
      const { data } = await request(buildUrl(table, {}, options));
      return { items: Array.isArray(data) ? data : [] };
    },

    async filter(filters = {}, options = {}) {
      const { data } = await request(buildUrl(table, filters, options));
      return { items: Array.isArray(data) ? data : [] };
    },

    async get(id) {
      const { data } = await request(buildUrl(table, { id }, { limit: 1 }));
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`${entityName} record not found.`);
      }
      return data[0];
    },

    async create(record) {
      const url = buildUrl(table, {}, {});
      const { data } = await request(url, { method: 'POST', body: record });
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`Neon did not return the created ${entityName} record.`);
      }
      return data[0];
    },

    async update(id, changes) {
      const url = buildUrl(table, { id }, {});
      const { data } = await request(url, { method: 'PATCH', body: changes });
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`${entityName} record not found or not editable.`);
      }
      return data[0];
    },

    async delete(id) {
      const url = buildUrl(table, { id }, {});
      await request(url, { method: 'DELETE' });
    },

    async count(filters = {}) {
      const url = buildUrl(table, filters, {}, 'id');
      const { response } = await request(url, { method: 'HEAD', prefer: 'count=exact' });
      const range = response.headers.get('content-range');
      const match = range?.match(/\/(\d+)$/);
      if (!match) throw new Error(`Neon did not return a count for ${entityName}.`);
      return Number(match[1]);
    },
  };

};

const rpc = async (functionName, body) => {
  const url = new URL(`${apiUrl()}/rpc/${functionName}`);
  const { data } = await request(url, { method: 'POST', body });
  return Array.isArray(data) ? data[0] : data;
};

/** @type {Record<string, ReturnType<typeof entityClient>>} */
const entities = new Proxy({}, {
  get(_target, entityName) {
    if (typeof entityName !== 'string') return undefined;
    return entityClient(entityName);
  },
});

const profileFields = new Set([
  'full_name',
  'avatar_url',
  'phone',
  'job_title',
  'business_name',
  'business_tagline',
  'business_phone',
  'business_email',
  'business_address',
  'business_gstin',
  'invoice_prefix',
  'invoice_terms',
  'payment_instructions',
  'notify_tasks',
  'notify_payments',
  'notify_daily',
  'browser_notifications',
]);

const getSessionUser = async () => {
  const { data, error } = await neonAuth.getSession({ query: {} });
  if (error) throw error;
  return data?.user ?? null;
};

export const neon = {
  entities,
  workspace: {
    ensureMembership() {
      return rpc('ensure_workspace_membership', {});
    },
    setMemberAccess({ userId, role, approvalStatus }) {
      return rpc('set_workspace_member_access', {
        p_user_id: userId,
        p_role: role,
        p_approval_status: approvalStatus,
      });
    },
    reviewTaskCompletion({ taskId, approved, note }) {
      return rpc('review_task_completion', {
        p_task_id: taskId,
        p_approved: approved,
        p_review_note: note || null,
      });
    },
  },
  payments: {
    async recordReceipt({ invoiceId, amount, receivedOn, method, reference, notes, idempotencyKey }) {
      const url = new URL(`${apiUrl()}/rpc/record_payment_receipt`);
      const { data } = await request(url, {
        method: 'POST',
        body: {
          p_invoice_id: invoiceId,
          p_amount: amount,
          p_received_on: receivedOn,
          p_method: method || null,
          p_reference: reference || null,
          p_notes: notes || null,
          p_idempotency_key: idempotencyKey,
        },
      });
      return data;
    },
  },
  auth: {
    async me() {
      const user = await getSessionUser();
      if (!user) return null;
      const profiles = await entityClient('User').filter({ id: user.id }, { limit: 1 });
      return { ...user, ...(profiles.items[0] || {}) };
    },

    async updateMe(changes) {
      const user = await getSessionUser();
      if (!user) throw new Error('Sign in before updating your profile.');

      const safeChanges = Object.fromEntries(
        Object.entries(changes).filter(([field]) => profileFields.has(field)),
      );
      const profiles = await entityClient('User').filter({ id: user.id }, { limit: 1 });
      if (profiles.items[0]) {
        await entityClient('User').update(user.id, safeChanges);
      } else {
        await entityClient('User').create({ id: user.id, owner_id: user.id, ...safeChanges });
      }
      return this.me();
    },

    async updateWorkspaceMemberProfile({ userId, workspaceOwnerId, changes }) {
      const safeChanges = Object.fromEntries(
        Object.entries(changes).filter(([field]) => ['full_name', 'avatar_url', 'phone', 'job_title'].includes(field)),
      );
      if (safeChanges.avatar_url && safeChanges.avatar_url.length > 500000) {
        throw new Error('Profile picture is too large. Choose a smaller image.');
      }

      const profiles = await entityClient('User').filter({ id: userId }, { limit: 1 });
      if (profiles.items[0]) {
        return entityClient('User').update(userId, safeChanges);
      }
      return entityClient('User').create({
        id: userId,
        owner_id: workspaceOwnerId,
        ...safeChanges,
      });
    },
  },
};
