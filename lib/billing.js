// Pricing, tax, discount and calendar rules shared by the API and the tests.
// Everything here is pure: callers pass in the records they want priced.

const MONTHLY_FACTOR = { daily: 30, weekly: 4.345, monthly: 1, yearly: 1 / 12 };

const round = (value) => Number(Number(value).toFixed(2));

function today(timeZone = process.env.BUSINESS_TIME_ZONE || 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

// Monthly and yearly cycles keep their anchor day, clamped to short months (Jan 31 → Feb 28 → Mar 31).
function addCycle(value, interval, anchorDay = null) {
  const date = new Date(`${value}T12:00:00Z`);
  if (interval === 'daily') date.setUTCDate(date.getUTCDate() + 1);
  else if (interval === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else {
    const dayOfMonth = Number(anchorDay || date.getUTCDate());
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + (interval === 'yearly' ? 12 : 1));
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(dayOfMonth, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

function isStrongPassword(password) {
  return typeof password === 'string' && password.length > 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function discountApplies(rule, lines, subtotal, onDate) {
  if (!rule || !rule.active) return false;
  if (rule.startDate && rule.startDate > onDate) return false;
  if (rule.endDate && rule.endDate < onDate) return false;
  if (rule.maxUses && rule.usedCount >= rule.maxUses) return false;
  const quantity = lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  return subtotal >= Number(rule.minimumPurchase || 0) && quantity >= Number(rule.minimumQuantity || 1);
}

// Prices subscription lines: discount is taken off before tax, split across eligible lines by amount.
function priceLines({ lines, discount, taxes }, onDate) {
  const rateFor = (taxIds = []) => taxIds.reduce((sum, id) => sum + Number(taxes.find((tax) => tax.id === id)?.rate || 0), 0);
  const priced = lines.map((line) => ({
    productId: line.productId,
    description: line.description,
    variant: line.variant || '',
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    taxRate: rateFor(line.taxIds),
    amount: round(Number(line.quantity) * Number(line.unitPrice)),
    discountAmount: 0,
  }));
  const subtotal = round(priced.reduce((sum, line) => sum + line.amount, 0));
  let discountAmount = 0;
  let discountId = '';
  if (discountApplies(discount, priced, subtotal, onDate)) {
    const scoped = discount.scope === 'products' && discount.productIds?.length;
    const eligible = scoped ? priced.filter((line) => discount.productIds.includes(line.productId)) : priced;
    const base = eligible.reduce((sum, line) => sum + line.amount, 0);
    if (base > 0) {
      const raw = discount.type === 'percentage' ? base * Number(discount.value) / 100 : Number(discount.value);
      discountAmount = round(Math.min(base, raw));
      discountId = discount.id;
      for (const line of eligible) line.discountAmount = round(discountAmount * line.amount / base);
    }
  }
  for (const line of priced) line.taxAmount = round((line.amount - line.discountAmount) * line.taxRate / 100);
  const taxAmount = round(priced.reduce((sum, line) => sum + line.taxAmount, 0));
  return { lines: priced, subtotal, discountAmount, discountId, taxAmount, total: round(Math.max(0, subtotal - discountAmount + taxAmount)) };
}

function monthlyValue(subscription, interval) {
  const total = subscription.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
  return total * (MONTHLY_FACTOR[interval] || 1);
}

module.exports = { round, today, addDays, addCycle, isStrongPassword, discountApplies, priceLines, monthlyValue };
