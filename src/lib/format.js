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

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDays = (days, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const fmtDate = (value, opts = {}) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: opts.year === false ? undefined : 'numeric' });
};

export const fmtDay = (value) => {
  if (!value) return '—';
  const d = new Date(value);
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
  const d = new Date(String(date).slice(0, 10));
  const t = new Date(todayISO());
  return Math.round((d - t) / 86400000);
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
  Math.round(Number(payment?.amount || 0) * (1 + Number(payment?.tax_rate || 0) / 100) - Number(payment?.discount || 0));

export const balanceDue = (payment) =>
  Math.max(0, invoiceTotal(payment) - Number(payment?.amount_received || 0));

export const isOpenInvoice = (payment) =>
  payment && !payment.is_demo && !['Paid', 'Cancelled', 'Draft'].includes(payment.status || '');