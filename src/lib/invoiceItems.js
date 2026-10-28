export const lineAmount = (item) => {
  const quantity = Number(item?.qty) || 0;
  const rate = Number(item?.rate) || 0;
  return Math.round(quantity * rate * 100) / 100;
};

export const invoiceSubtotal = (items = []) =>
  items.reduce((total, item) => total + lineAmount(item), 0);

export const savedLineItems = (items = []) =>
  items.map((item) => ({
    description: String(item.description || '').trim(),
    note: String(item.note || '').trim(),
    qty: Number(item.qty) || 0,
    rate: Number(item.rate) || 0,
    amount: lineAmount(item),
  }));

export const invoiceItemsForPayment = (payment) => {
  if (Array.isArray(payment?.line_items) && payment.line_items.length) {
    return payment.line_items.map((item) => ({ ...item }));
  }
  return [{
    description: payment?.title || '',
    note: '',
    qty: 1,
    rate: Number(payment?.amount) || 0,
  }];
};

export const blankInvoiceItem = (description = '') => ({
  description,
  note: '',
  qty: 1,
  rate: '',
});
