export const inr = (value, compact = false) => {
  const n = Number(value || 0);
  if (compact && Math.abs(n) >= 100000) {
    return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  }
  if (compact && Math.abs(n) >= 1000) {
    return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  }
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const localDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }
  return new Date(value);
};

const localISODate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

export const todayISO = () => localISODate(new Date());

export const addDays = (days, from = new Date()) => {
  const d = localDate(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return localISODate(d);
};

export const fmtDate = (value, opts = {}) => {
  if (!value) return '—';
  const d = localDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: opts.year === false ? undefined : 'numeric' });
};

export const fmtDay = (value) => {
  if (!value) return '—';
  const d = localDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const monthKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (key) => {
  if (!key) return '—';
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export const isOverdue = (date) => {
  if (!date) return false;
  const today = todayISO();
  return String(date).slice(0, 10) < today;
};

export const daysUntil = (date) => {
  if (!date) return null;
  const d = localDate(String(date).slice(0, 10));
  const t = localDate(todayISO());
  d.setHours(12, 0, 0, 0);
  t.setHours(12, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

export const relative = (date) => {
  const diff = daysUntil(date);
  if (diff === null) return '—';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `in ${diff}d`;
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export const total = (items, key) => items.reduce((sum, item) => sum + Number(item[key] || 0), 0);

export const invoiceTotal = (payment) =>
  Math.max(0, Math.round(Number(payment?.amount || 0) * (1 + Number(payment?.tax_rate || 0) / 100) - Number(payment?.discount || 0)));

export const balanceDue = (payment) =>
  Math.max(0, invoiceTotal(payment) - Number(payment?.amount_received || 0));

// Payment status is derived from the financial record where possible. This keeps
// every screen consistent without allowing a status toggle to claim money was
// received before a receipt exists in the ledger.
export const effectivePaymentStatus = (payment) => {
  if (!payment) return '';
  const stored = payment.status || 'Pending';
  if (['Draft', 'Cancelled'].includes(stored)) return stored;
  if (balanceDue(payment) <= 0) return 'Paid';
  if (payment.due_date && String(payment.due_date).slice(0, 10) < todayISO()) return 'Overdue';
  if (Number(payment.amount_received || 0) > 0) return 'Partially Paid';
  return stored === 'Overdue' ? 'Pending' : stored;
};

export const isOpenInvoice = (payment) =>
  payment && !payment.is_demo && !['Paid', 'Cancelled', 'Draft'].includes(effectivePaymentStatus(payment));
