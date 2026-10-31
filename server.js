const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { uid, readDatabase, writeDatabase } = require('./lib/store');
const billing = require('./lib/billing');
const { today, addDays, addCycle } = billing;

const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();
const loginAttempts = new Map();
const publicRoot = path.join(__dirname);
const COOKIE = 'brightloop_session';
const DAY = 86400000;
let db = readDatabase();
const scrypt = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');

function save() { writeDatabase(db); }
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function hashPassword(password) {
  if (!billing.isStrongPassword(password)) fail(400, 'Password must be more than 8 characters and include uppercase, lowercase, and a special character.');
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${scrypt(password, salt)}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = Buffer.from(scrypt(String(password || ''), salt), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId || null }; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
async function deliverEmail(message) {
  if (!process.env.EMAIL_API_URL) return false;
  const response = await fetch(process.env.EMAIL_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EMAIL_API_KEY ? { Authorization: `Bearer ${process.env.EMAIL_API_KEY}` } : {}) }, body: JSON.stringify(message) });
  if (!response.ok) fail(502, `Email delivery service returned ${response.status}.`);
  return true;
}
function getCookie(request, name) {
  const value = (request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}
function currentUser(request) {
  const token = getCookie(request, COOKIE);
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) { sessions.delete(token); return null; }
  const user = db.users.find((item) => item.id === session.userId);
  return user || null;
}
function requireUser(user) { if (!user) fail(401, 'Sign in to continue.'); return user; }
function requireRole(user, ...roles) { requireUser(user); if (!roles.includes(user.role)) fail(403, 'You do not have access to this action.'); return user; }
function ownedOrStaff(user, entity, customerId) {
  requireUser(user);
  if (user.role !== 'customer') return;
  if (!customerId || user.customerId !== customerId) fail(404, `${entity} not found.`);
}
function respond(response, status, payload, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(payload));
}
function sessionCookie(token, maxAge = 43200, secure = false) {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
function parseCookiesSecure(request) { return Boolean(request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https'); }
async function readBody(request) {
  const parts = [];
  let size = 0;
  for await (const part of request) { size += part.length; if (size > 1_000_000) fail(413, 'Request body is too large.'); parts.push(part); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { fail(400, 'Request body must be valid JSON.'); }
}
function byId(collection, id, name = 'Record') { const item = collection.find((row) => row.id === id); if (!item) fail(404, `${name} not found.`); return item; }
function userCustomer(user) { return db.customers.find((item) => item.id === user.customerId); }
function safeNumber(value, field, { min = 0, required = true } = {}) {
  if ((!required && (value === '' || value === undefined || value === null))) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) fail(400, `${field} must be a number of at least ${min}.`);
  return number;
}
function normalizeLines(lines, fallbackPlan) {
  if (!Array.isArray(lines) || !lines.length) fail(400, 'Add at least one subscription line.');
  return lines.map((line) => {
    const product = byId(db.products, line.productId, 'Product');
    const quantity = safeNumber(line.quantity, 'Quantity', { min: 1 });
    const unitPrice = safeNumber(line.unitPrice ?? product.salesPrice, 'Unit price');
    const taxIds = Array.isArray(line.taxIds) ? line.taxIds.filter((id) => db.taxes.some((tax) => tax.id === id && tax.active)) : [];
    return { productId: product.id, description: String(line.description || product.name).slice(0, 160), quantity, unitPrice, variant: String(line.variant || '').slice(0, 80), taxIds, planId: line.planId || fallbackPlan || null };
  });
}
// One pass over payments per request; callers reuse the map instead of rescanning payments per invoice.
function paidTotals() {
  const totals = new Map();
  for (const payment of db.payments) totals.set(payment.invoiceId, (totals.get(payment.invoiceId) || 0) + Number(payment.amount));
  return totals;
}
function outstanding(invoice, paid = paidTotals()) { return Math.max(0, billing.round(invoice.total - (paid.get(invoice.id) || 0))); }
function indexById(collection) { return new Map(collection.map((item) => [item.id, item])); }
function subscriptionAccess(user, subscription) { ownedOrStaff(user, 'Subscription', subscription.customerId); }
function invoiceAccess(user, invoice) { ownedOrStaff(user, 'Invoice', invoice.customerId); }
function priceSubscription(subscription, onDate = today()) {
  const lines = subscription.lines.map((line) => ({ ...line, description: line.description || byId(db.products, line.productId, 'Product').name }));
  const discount = db.discounts.find((item) => item.id === subscription.discountId);
  return billing.priceLines({ lines, discount, taxes: db.taxes.filter((tax) => tax.active) }, onDate);
}
function buildInvoice(subscription, period) {
  if (db.invoices.some((invoice) => invoice.subscriptionId === subscription.id && invoice.billingPeriod === period)) return null;
  const customer = byId(db.customers, subscription.customerId, 'Customer');
  const priced = priceSubscription(subscription, period);
  db.counters.invoice += 1;
  const invoice = {
    id: uid('inv'), number: `INV-${String(db.counters.invoice).padStart(4, '0')}`, customerId: customer.id,
    subscriptionId: subscription.id, billingPeriod: period, issueDate: period, dueDate: addDays(period, subscription.paymentTermsDays),
    ...priced, status: 'Draft', sentAt: '', cancelled: false,
  };
  db.invoices.unshift(invoice);
  if (priced.discountId) byId(db.discounts, priced.discountId, 'Discount').usedCount += 1;
  return invoice;
}
function runBilling() {
  const created = [];
  let modified = false;
  const currentDay = today();
  for (const subscription of db.subscriptions) {
    const plan = byId(db.plans, subscription.planId, 'Plan');
    if (subscription.expiryDate && subscription.expiryDate < currentDay && plan.autoClose && ['Active', 'Paused'].includes(subscription.status)) { subscription.status = 'Closed'; modified = true; continue; }
    if (subscription.status !== 'Active' || !subscription.nextBillingDate) continue;
    let iterations = 0;
    while (subscription.nextBillingDate <= currentDay && iterations < 500) {
      if (subscription.expiryDate && subscription.nextBillingDate > subscription.expiryDate) {
        if (plan.autoClose) { subscription.status = 'Closed'; modified = true; }
        break;
      }
      const period = subscription.nextBillingDate;
      const invoice = buildInvoice(subscription, period);
      if (invoice) created.push(invoice);
      subscription.billingDay ||= Number(period.slice(-2));
      subscription.nextBillingDate = addCycle(subscription.nextBillingDate, plan.interval, subscription.billingDay);
      modified = true;
      iterations += 1;
    }
    if (subscription.expiryDate && subscription.expiryDate < currentDay && subscription.status === 'Active' && plan.autoClose) { subscription.status = 'Closed'; modified = true; }
  }
  if (modified || created.length) save();
  return created;
}
function summary(source = db, customerId = null, from = '', to = '') {
  const subscriptions = source.subscriptions.filter((item) => !customerId || item.customerId === customerId);
  const invoices = source.invoices.filter((item) => (!customerId || item.customerId === customerId) && (!from || item.issueDate >= from) && (!to || item.issueDate <= to) && !item.cancelled);
  const invoiceIds = new Set(invoices.map((item) => item.id));
  const payments = source.payments.filter((item) => invoiceIds.has(item.invoiceId) && (!from || item.date >= from) && (!to || item.date <= to));
  const mrr = subscriptions.filter((item) => item.status === 'Active').reduce((sum, item) => sum + billing.monthlyValue(item, byId(source.plans, item.planId, 'Plan').interval), 0);
  const paid = payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const paidMap = paidTotals();
  const owed = invoices.reduce((sum, item) => sum + outstanding(item, paidMap), 0);
  const overdue = invoices.filter((item) => item.status !== 'Draft' && item.dueDate < today()).reduce((sum, item) => sum + outstanding(item, paidMap), 0);
  return { activeSubscriptions: subscriptions.filter((item) => item.status === 'Active').length, mrr: Number(mrr.toFixed(2)), revenue: Number(paid.toFixed(2)), outstanding: Number(owed.toFixed(2)), overdue: Number(overdue.toFixed(2)), invoiceCount: invoices.length };
}
function collectionName(pathName) {
  const names = { customers: 'customers', products: 'products', plans: 'plans', taxes: 'taxes', discounts: 'discounts', 'quote-templates': 'quoteTemplates' };
  return names[pathName] || '';
}
function createRecord(kind, body, user) {
  const id = uid(kind.slice(0, 3));
  const active = body.active !== false;
  if (kind === 'customers') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) fail(400, 'Enter a valid customer email.');
    if (db.customers.some((item) => item.email.toLowerCase() === email)) fail(409, 'A customer with this email already exists.');
    const record = { id, name: String(body.name || '').trim(), company: String(body.company || '').trim(), email, phone: String(body.phone || '').trim(), createdAt: new Date().toISOString() };
    if (!record.name) fail(400, 'Customer name is required.');
    return record;
  }
  if (kind === 'products') {
    const record = { id, name: String(body.name || '').trim(), type: String(body.type || 'service'), salesPrice: safeNumber(body.salesPrice, 'Sales price'), costPrice: safeNumber(body.costPrice, 'Cost price'), notes: String(body.notes || '').slice(0, 1000), variants: Array.isArray(body.variants) ? body.variants.map((v) => ({ name: String(v.name || '').trim(), priceDelta: safeNumber(v.priceDelta || 0, 'Variant price') })).filter((v) => v.name) : [], active };
    if (!record.name) fail(400, 'Product name is required.');
    return record;
  }
  if (kind === 'plans') {
    const interval = String(body.interval || 'monthly');
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(interval)) fail(400, 'Choose a supported billing interval.');
    byId(db.products, body.productId, 'Product');
    const record = { id, name: String(body.name || '').trim(), productId: body.productId, price: safeNumber(body.price, 'Plan price'), interval, minQuantity: safeNumber(body.minQuantity || 1, 'Minimum quantity', { min: 1 }), availableFrom: String(body.availableFrom || today()), availableTo: String(body.availableTo || ''), autoClose: Boolean(body.autoClose), allowEarlyClose: Boolean(body.allowEarlyClose), allowPause: Boolean(body.allowPause), allowRenew: Boolean(body.allowRenew), active };
    if (!record.name) fail(400, 'Plan name is required.');
    return record;
  }
  if (kind === 'taxes') {
    const rate = safeNumber(body.rate, 'Tax rate'); if (rate > 100) fail(400, 'Tax rate cannot exceed 100%.');
    const name = String(body.name || '').trim(); if (!name) fail(400, 'Tax name is required.');
    return { id, name, rate, active };
  }
  if (kind === 'discounts') {
    const type = String(body.type || 'percentage'); if (!['percentage', 'fixed'].includes(type)) fail(400, 'Discount type must be percentage or fixed.');
    const value = safeNumber(body.value, 'Discount value'); if (type === 'percentage' && value > 100) fail(400, 'Percentage discount cannot exceed 100%.');
    return { id, name: String(body.name || '').trim(), type, value, minimumPurchase: safeNumber(body.minimumPurchase || 0, 'Minimum purchase'), minimumQuantity: safeNumber(body.minimumQuantity || 1, 'Minimum quantity', { min: 1 }), startDate: String(body.startDate || today()), endDate: String(body.endDate || ''), maxUses: safeNumber(body.maxUses || 0, 'Usage limit'), usedCount: 0, scope: body.scope === 'products' ? 'products' : 'subscriptions', productIds: Array.isArray(body.productIds) ? body.productIds : [], active };
  }
  if (kind === 'quote-templates') {
    const plan = byId(db.plans, body.planId, 'Plan');
    return { id, name: String(body.name || '').trim(), validityDays: safeNumber(body.validityDays || 30, 'Validity days', { min: 1 }), planId: plan.id, lines: normalizeLines(body.lines?.length ? body.lines : [{ productId: plan.productId, quantity: plan.minQuantity, unitPrice: plan.price, taxIds: [] }], plan.id) };
  }
  return null;
}
function publicData(user, searchParams) {
  const customerId = user.role === 'customer' ? user.customerId : null;
  const result = { user: publicUser(user), summary: summary(db, customerId, searchParams.get('from') || '', searchParams.get('to') || '') };
  if (user.role !== 'customer') result.customers = db.customers;
  result.products = db.products;
  result.plans = db.plans;
  result.taxes = db.taxes;
  result.discounts = user.role === 'customer' ? [] : db.discounts;
  result.quoteTemplates = user.role === 'customer' ? [] : db.quoteTemplates;
  const customers = indexById(db.customers); const plans = indexById(db.plans); const subscriptions = indexById(db.subscriptions); const paid = paidTotals(); const currentDay = today();
  result.subscriptions = db.subscriptions.filter((item) => !customerId || item.customerId === customerId).map((item) => ({ ...item, customer: customers.get(item.customerId), plan: plans.get(item.planId) }));
  result.invoices = db.invoices.filter((item) => (!customerId || item.customerId === customerId) && !item.cancelled).map((item) => {
    const balance = outstanding(item, paid);
    const subscription = subscriptions.get(item.subscriptionId);
    return { ...item, customer: customers.get(item.customerId), subscription: subscription && { id: subscription.id, number: subscription.number }, paid: billing.round(item.total - balance), outstanding: balance, status: balance <= 0 ? 'Paid' : (item.status === 'Confirmed' && item.dueDate < currentDay ? 'Overdue' : item.status) };
  });
  result.payments = db.payments.filter((item) => !customerId || db.invoices.find((invoice) => invoice.id === item.invoiceId)?.customerId === customerId);
  if (user.role === 'admin') result.users = db.users.map(publicUser);
  return result;
}

// Give each first-run demo account a private development password. Existing password hashes are never reset.
const demoPasswords = { 'admin@brightloop.io': 'Brightloop!2026', 'staff@brightloop.io': 'Brightloop!2026', 'olivia@northstar.io': 'Brightloop!2026' };
let demoPasswordsSeeded = false;
const initialAdmin = db.users.find((user) => user.role === 'admin' && !user.passwordHash);
if (process.env.NODE_ENV === 'production' && initialAdmin && !process.env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD before first production startup.');
for (const user of db.users) if (!user.passwordHash) {
  if (process.env.NODE_ENV === 'production') {
    if (user.role === 'admin') user.passwordHash = hashPassword(process.env.ADMIN_PASSWORD);
    else { const salt = crypto.randomBytes(16).toString('hex'); user.passwordHash = `${salt}:${scrypt(crypto.randomBytes(32).toString('hex'), salt)}`; }
    demoPasswordsSeeded = true;
  } else if (demoPasswords[user.email]) { user.passwordHash = `${user.email}:${scrypt(demoPasswords[user.email], user.email)}`; demoPasswordsSeeded = true; }
}
if (demoPasswordsSeeded) save();

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = request.method;
  const user = currentUser(request);
  if (pathname.startsWith('/api/')) {
    if (method === 'GET' && pathname === '/api/health') return respond(response, 200, { status: 'ok' });
    if (method === 'POST' && pathname === '/api/auth/signup') {
      const body = await readBody(request);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter your name and a valid email address.');
      if (db.users.some((item) => item.email.toLowerCase() === email)) fail(409, 'An account with this email already exists.');
      const passwordHash = hashPassword(body.password);
      const customer = { id: uid('cus'), name, company: String(body.company || '').trim(), email, phone: '', createdAt: new Date().toISOString() };
      const newUser = { id: uid('usr'), name, email, role: 'customer', customerId: customer.id, passwordHash, createdAt: new Date().toISOString() };
      db.customers.push(customer); db.users.push(newUser); save();
      const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId: newUser.id, expires: Date.now() + 12 * 60 * 60 * 1000 });
      return respond(response, 201, { user: publicUser(newUser) }, { 'Set-Cookie': sessionCookie(token, 43200, parseCookiesSecure(request)) });
    }
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      const address = request.socket.remoteAddress || 'unknown';
      const attemptsKey = `${address}:${email}`;
      const attempts = loginAttempts.get(attemptsKey) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
      if (attempts.resetAt < Date.now()) { attempts.count = 0; attempts.resetAt = Date.now() + 15 * 60 * 1000; }
      if (attempts.count >= 10) fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
      const account = db.users.find((item) => item.email.toLowerCase() === email);
      if (!account || !verifyPassword(body.password, account.passwordHash)) { attempts.count += 1; loginAttempts.set(attemptsKey, attempts); fail(401, 'Email or password is incorrect.'); }
      loginAttempts.delete(attemptsKey);
      const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId: account.id, expires: Date.now() + 12 * 60 * 60 * 1000 });
      return respond(response, 200, { user: publicUser(account) }, { 'Set-Cookie': sessionCookie(token, 43200, parseCookiesSecure(request)) });
    }
    if (method === 'POST' && pathname === '/api/auth/logout') {
      sessions.delete(getCookie(request, COOKIE));
      return respond(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0, parseCookiesSecure(request)) });
    }
    if (method === 'GET' && pathname === '/api/session') return respond(response, 200, { user: user ? publicUser(user) : null });
    if (method === 'POST' && pathname === '/api/auth/password-reset') {
      const body = await readBody(request); const email = String(body.email || '').trim().toLowerCase(); const account = db.users.find((item) => item.email.toLowerCase() === email);
      let resetLink = '';
      if (account) {
        const token = crypto.randomBytes(32).toString('hex');
        db.passwordResets = db.passwordResets.filter((item) => item.userId !== account.id);
        db.passwordResets.push({ userId: account.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expires: Date.now() + 30 * 60 * 1000 }); save();
        const resetUrl = `${process.env.PUBLIC_URL || `http://localhost:${PORT}`}/reset-password?token=${token}`;
        if (process.env.EMAIL_API_URL) await deliverEmail({ to: account.email, subject: 'Reset your Brightloop password', text: `Use this link within 30 minutes to reset your password: ${resetUrl}`, html: `<p>Use this link within 30 minutes to reset your password:</p><p><a href="${resetUrl}">Reset password</a></p>` });
        else if (process.env.NODE_ENV !== 'production') { resetLink = `/reset-password?token=${token}`; console.log(`Development password reset for ${account.email}: ${resetUrl}`); }
      }
      return respond(response, 200, { message: 'If that email has an account, password reset instructions are ready.', resetLink });
    }
    if (method === 'POST' && pathname === '/api/auth/password-reset/complete') {
      const body = await readBody(request); const tokenHash = crypto.createHash('sha256').update(String(body.token || '')).digest('hex'); const reset = db.passwordResets.find((item) => item.tokenHash === tokenHash && item.expires > Date.now());
      if (!reset) fail(400, 'This reset link is invalid or expired.'); const account = byId(db.users, reset.userId, 'Account'); account.passwordHash = hashPassword(body.password); db.passwordResets = db.passwordResets.filter((item) => item !== reset); save();
      return respond(response, 200, { message: 'Password updated. You can sign in now.' });
    }
    if (method === 'GET' && pathname === '/api/data') { requireUser(user); return respond(response, 200, publicData(user, url.searchParams)); }
    const usersMatch = pathname.match(/^\/api\/users(?:\/([^/]+))?$/);
    if (usersMatch) {
      requireRole(user, 'admin');
      if (method === 'POST' && !usersMatch[1]) {
        const body = await readBody(request); const email = String(body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || db.users.some((item) => item.email.toLowerCase() === email)) fail(409, 'Use a valid, unused email address.');
        if (!['admin', 'staff'].includes(body.role)) fail(400, 'Staff accounts must have the admin or staff role.');
        const account = { id: uid('usr'), name: String(body.name || '').trim(), email, role: body.role, customerId: null, passwordHash: hashPassword(body.password), createdAt: new Date().toISOString() };
        if (!account.name) fail(400, 'Name is required.'); db.users.push(account); save(); return respond(response, 201, { user: publicUser(account) });
      }
      if (method === 'PATCH' && usersMatch[1]) {
        const target = byId(db.users, usersMatch[1], 'User'); const body = await readBody(request);
        if (target.id === user.id && body.role && body.role !== 'admin') fail(400, 'You cannot remove your own admin role.');
        if (body.role && !['admin', 'staff', 'customer'].includes(body.role)) fail(400, 'Invalid role.');
        if (body.name) target.name = String(body.name).trim(); if (body.role) target.role = body.role; save(); return respond(response, 200, { user: publicUser(target) });
      }
    }
    const collectionMatch = pathname.match(/^\/api\/(customers|products|plans|taxes|discounts|quote-templates)(?:\/([^/]+))?$/);
    if (collectionMatch) {
      const kind = collectionName(collectionMatch[1]); const recordId = collectionMatch[2];
      if (method === 'GET') { requireUser(user); const records = kind === 'customers' && user.role === 'customer' ? [userCustomer(user)].filter(Boolean) : db[kind]; if (recordId) return respond(response, 200, byId(records, recordId)); return respond(response, 200, records); }
      if (kind === 'customers') requireRole(user, 'admin', 'staff'); else requireRole(user, 'admin');
      if (method === 'POST' && !recordId) { const body = await readBody(request); const record = createRecord(kind, body, user); if (!record) fail(400, 'Unsupported record type.'); db[kind].unshift(record); save(); return respond(response, 201, record); }
      if (method === 'PATCH' && recordId) {
        const body = await readBody(request); const record = byId(db[kind], recordId);
        if (kind === 'products') Object.assign(record, { name: body.name ?? record.name, type: body.type ?? record.type, salesPrice: body.salesPrice === undefined ? record.salesPrice : safeNumber(body.salesPrice, 'Sales price'), costPrice: body.costPrice === undefined ? record.costPrice : safeNumber(body.costPrice, 'Cost price'), notes: body.notes ?? record.notes, variants: body.variants ?? record.variants, active: body.active ?? record.active });
        else if (kind === 'plans') { for (const key of ['name', 'price', 'interval', 'minQuantity', 'availableFrom', 'availableTo', 'autoClose', 'allowEarlyClose', 'allowPause', 'allowRenew', 'active']) if (body[key] !== undefined) record[key] = body[key]; if (body.productId !== undefined) { byId(db.products, body.productId, 'Product'); record.productId = body.productId; } if (!['daily', 'weekly', 'monthly', 'yearly'].includes(record.interval)) fail(400, 'Choose a supported billing interval.'); }
        else if (kind === 'taxes') { if (body.name !== undefined) record.name = String(body.name).trim(); if (body.rate !== undefined) { record.rate = safeNumber(body.rate, 'Tax rate'); if (record.rate > 100) fail(400, 'Tax rate cannot exceed 100%.'); } if (body.active !== undefined) record.active = Boolean(body.active); if (!record.name) fail(400, 'Tax name is required.'); }
        else Object.assign(record, body, { id: record.id });
        save(); return respond(response, 200, record);
      }
      if (method === 'DELETE' && recordId) { const record = byId(db[kind], recordId); if (['products', 'plans'].includes(kind)) record.active = false; else db[kind] = db[kind].filter((item) => item.id !== recordId); save(); return respond(response, 200, { ok: true }); }
    }
    if (pathname === '/api/subscriptions' && method === 'POST') {
      requireUser(user); const body = await readBody(request);
      const customerId = user.role === 'customer' ? user.customerId : body.customerId; const customer = byId(db.customers, customerId, 'Customer');
      if (user.role === 'staff' || user.role === 'admin') requireRole(user, 'admin', 'staff');
      let template = body.templateId ? byId(db.quoteTemplates, body.templateId, 'Quote template') : null;
      const plan = byId(db.plans, template?.planId || body.planId, 'Plan');
      if (!plan.active || plan.availableFrom > today() || (plan.availableTo && plan.availableTo < today())) fail(400, 'This plan is not available for a new subscription.');
      const requestedLines = body.lines?.length ? body.lines : template ? [...template.lines, ...(Array.isArray(body.addOnLines) ? body.addOnLines : [])] : [{ productId: plan.productId, quantity: plan.minQuantity, unitPrice: plan.price, taxIds: [] }];
      const lines = normalizeLines(requestedLines, plan.id);
      if (lines.filter((line) => line.productId === plan.productId).reduce((sum, line) => sum + line.quantity, 0) < plan.minQuantity) fail(400, `This plan requires at least ${plan.minQuantity} seats of its primary product.`);
      const startDate = String(body.startDate || today()); const status = template ? 'Quotation' : (user.role === 'customer' ? 'Active' : 'Draft');
      db.counters.subscription += 1;
      const subscription = { id: uid('sub'), number: `SUB-${String(db.counters.subscription).padStart(4, '0')}`, customerId: customer.id, planId: plan.id, status, startDate, expiryDate: String(body.expiryDate || (template ? addDays(today(), template.validityDays) : '')), nextBillingDate: startDate, billingDay: Number(startDate.slice(-2)), paymentTermsDays: safeNumber(body.paymentTermsDays ?? 15, 'Payment terms', { min: 0 }), discountId: String(body.discountId || ''), lines, quoteTemplateId: template?.id || '' };
      if (subscription.discountId) byId(db.discounts, subscription.discountId, 'Discount');
      db.subscriptions.unshift(subscription); save(); return respond(response, 201, subscription);
    }
    const subscriptionMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)(?:\/(action|renew))?$/);
    if (subscriptionMatch) {
      requireUser(user); const subscription = byId(db.subscriptions, subscriptionMatch[1], 'Subscription'); subscriptionAccess(user, subscription);
      if (method === 'GET' && !subscriptionMatch[2]) return respond(response, 200, subscription);
      if (method === 'PATCH' && !subscriptionMatch[2]) {
        requireRole(user, 'admin', 'staff'); const body = await readBody(request);
        if (body.discountId !== undefined) { if (body.discountId) byId(db.discounts, body.discountId, 'Discount'); subscription.discountId = body.discountId; }
        if (body.paymentTermsDays !== undefined) subscription.paymentTermsDays = safeNumber(body.paymentTermsDays, 'Payment terms', { min: 0 });
        if (body.expiryDate !== undefined) subscription.expiryDate = body.expiryDate;
        if (body.lines !== undefined) subscription.lines = normalizeLines(body.lines, subscription.planId);
        save(); return respond(response, 200, subscription);
      }
      if (method === 'POST' && subscriptionMatch[2] === 'action') {
        const body = await readBody(request); const action = body.action; const plan = byId(db.plans, subscription.planId, 'Plan');
        const allowed = (action !== 'pause' || plan.allowPause) && (action !== 'close' || plan.allowEarlyClose) && (action !== 'renew' || plan.allowRenew);
        if (!allowed) fail(403, 'Your plan does not allow this action.');
        const transitions = { quotation: ['Draft'], confirm: ['Quotation'], activate: ['Confirmed'], pause: ['Active'], resume: ['Paused'], close: ['Active', 'Paused', 'Draft', 'Quotation', 'Confirmed'], renew: ['Closed'] };
        const target = { quotation: 'Quotation', confirm: 'Confirmed', activate: 'Active', pause: 'Paused', resume: 'Active', close: 'Closed', renew: 'Active' }[action];
        if (!target || !transitions[action].includes(subscription.status)) fail(409, `Cannot ${action} a ${subscription.status.toLowerCase()} subscription.`);
        if (action === 'renew' && !plan.allowRenew) fail(400, 'Renewal is disabled for this plan.');
        if (action === 'activate' || action === 'renew') { subscription.startDate = today(); subscription.nextBillingDate = today(); if (action === 'renew') subscription.expiryDate = ''; }
        if (action === 'activate' || action === 'renew' || action === 'resume') subscription.billingDay = Number(today().slice(-2));
        if (action === 'resume') subscription.nextBillingDate = today();
        if (action === 'quotation' && !subscription.expiryDate) subscription.expiryDate = addDays(today(), 30);
        if (action === 'confirm' && subscription.expiryDate && subscription.expiryDate < today()) fail(400, 'This quotation has expired.');
        subscription.status = target; save(); return respond(response, 200, subscription);
      }
    }
    if (pathname === '/api/billing/run' && method === 'POST') { requireRole(user, 'admin', 'staff'); const invoices = runBilling(); return respond(response, 200, { created: invoices.length, invoices }); }
    if (pathname === '/api/invoices' && method === 'POST') {
      requireRole(user, 'admin', 'staff'); const body = await readBody(request); const subscription = byId(db.subscriptions, body.subscriptionId, 'Subscription');
      const invoice = buildInvoice(subscription, String(body.period || today())); if (!invoice) fail(409, 'An invoice already exists for this subscription and billing period.'); save(); return respond(response, 201, invoice);
    }
    const invoiceMatch = pathname.match(/^\/api\/invoices\/([^/]+)(?:\/(action|payments))?$/);
    if (invoiceMatch) {
      requireUser(user); const invoice = byId(db.invoices, invoiceMatch[1], 'Invoice'); invoiceAccess(user, invoice);
      if (method === 'GET' && !invoiceMatch[2]) return respond(response, 200, { ...invoice, payments: db.payments.filter((payment) => payment.invoiceId === invoice.id), outstanding: outstanding(invoice) });
      if (method === 'POST' && invoiceMatch[2] === 'action') {
        requireRole(user, 'admin', 'staff'); const body = await readBody(request);
        let deliveryStatus = '';
        if (body.action === 'confirm' && invoice.status === 'Draft' && !invoice.cancelled) invoice.status = 'Confirmed';
        else if (body.action === 'cancel' && ['Draft', 'Confirmed'].includes(invoice.status) && !db.payments.some((payment) => payment.invoiceId === invoice.id)) { invoice.cancelled = true; const rule = db.discounts.find((item) => item.id === invoice.discountId); if (rule) rule.usedCount = Math.max(0, rule.usedCount - 1); }
        else if (body.action === 'send' && !invoice.cancelled && !invoice.sentAt) {
          const customer = byId(db.customers, invoice.customerId, 'Customer');
          const lines = invoice.lines.map((line) => `${line.description} x ${line.quantity}: $${line.amount.toFixed(2)}`).join('\n');
          const message = { to: customer.email, subject: `Brightloop invoice ${invoice.number}`, text: `Hello ${customer.name},\n\nInvoice ${invoice.number} is due ${invoice.dueDate}.\n${lines}\nTotal: $${invoice.total.toFixed(2)}\n\nThank you, Brightloop`, html: `<p>Hello ${escapeHtml(customer.name)},</p><p>Invoice <strong>${escapeHtml(invoice.number)}</strong> is due ${escapeHtml(invoice.dueDate)}.</p><pre>${escapeHtml(lines)}</pre><p>Total: <strong>$${invoice.total.toFixed(2)}</strong></p><p>Thank you, Brightloop</p>` };
          deliveryStatus = await deliverEmail(message) ? 'delivered' : 'queued';
          if (deliveryStatus === 'queued') { db.emailOutbox ||= []; db.emailOutbox.unshift({ ...message, id: uid('mail'), invoiceId: invoice.id, createdAt: new Date().toISOString(), status: 'queued' }); }
          invoice.status = invoice.status === 'Draft' ? 'Confirmed' : invoice.status; invoice.sentAt = new Date().toISOString(); invoice.deliveryStatus = deliveryStatus;
        }
        else if (body.action === 'resend' && invoice.deliveryStatus === 'queued') {
          const queued = (db.emailOutbox || []).find((item) => item.invoiceId === invoice.id && item.status === 'queued');
          if (!queued) fail(404, 'Queued email was not found.');
          if (!await deliverEmail({ to: queued.to, subject: queued.subject, text: queued.text, html: queued.html })) fail(503, 'Configure EMAIL_API_URL to deliver queued invoice emails.');
          queued.status = 'delivered'; queued.deliveredAt = new Date().toISOString(); invoice.deliveryStatus = 'delivered';
          deliveryStatus = 'delivered';
        }
        else fail(409, 'That invoice action is not available in its current state.');
        save(); return respond(response, 200, { ...invoice, deliveryStatus });
      }
      if (method === 'POST' && invoiceMatch[2] === 'payments') {
        requireRole(user, 'admin', 'staff'); const body = await readBody(request);
        if (!['card', 'bank transfer', 'cash', 'direct debit', 'other'].includes(body.method)) fail(400, 'Choose a supported payment method.');
        if (invoice.cancelled) fail(409, 'A cancelled invoice cannot receive a payment.');
        const amount = safeNumber(body.amount, 'Payment amount', { min: 0.01 }); if (amount > outstanding(invoice) + 0.005) fail(400, 'Payment exceeds the outstanding invoice balance.');
        const payment = { id: uid('pay'), invoiceId: invoice.id, method: body.method, amount: Number(amount.toFixed(2)), date: String(body.date || today()), note: String(body.note || '').slice(0, 500) };
        db.payments.unshift(payment); if (outstanding(invoice) <= 0.005) invoice.status = 'Paid'; else if (invoice.status === 'Draft') invoice.status = 'Confirmed'; save();
        return respond(response, 201, { payment, outstanding: outstanding(invoice), status: invoice.status });
      }
    }
    if (pathname === '/api/reports' && method === 'GET') {
      requireUser(user); const customerId = user.role === 'customer' ? user.customerId : null; const report = summary(db, customerId, url.searchParams.get('from') || '', url.searchParams.get('to') || '');
      const paid = paidTotals(); const currentDay = today(); const from = url.searchParams.get('from') || ''; const to = url.searchParams.get('to') || '';
      const invoices = db.invoices.filter((invoice) => (!customerId || invoice.customerId === customerId) && !invoice.cancelled && (!from || invoice.issueDate >= from) && (!to || invoice.issueDate <= to)).map((invoice) => { const balance = outstanding(invoice, paid); return { id: invoice.id, number: invoice.number, customerId: invoice.customerId, subscriptionId: invoice.subscriptionId, issueDate: invoice.issueDate, dueDate: invoice.dueDate, total: invoice.total, outstanding: balance, status: balance <= 0 ? 'Paid' : invoice.status !== 'Draft' && invoice.dueDate < currentDay ? 'Overdue' : invoice.status }; });
      return respond(response, 200, { ...report, invoices });
    }
    fail(404, 'API route not found.');
  }
  if (method !== 'GET' && method !== 'HEAD') return respond(response, 405, { error: 'Method not allowed.' });
  const relative = pathname === '/' || pathname === '/reset-password' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!['index.html', 'styles.css', 'app.js'].includes(relative)) return respond(response, 404, { error: 'Not found.' });
  const filename = path.resolve(publicRoot, relative);
  if (!filename.startsWith(`${publicRoot}${path.sep}`) && filename !== path.join(publicRoot, 'index.html')) return respond(response, 403, { error: 'Forbidden.' });
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return respond(response, 404, { error: 'Not found.' });
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
  response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
  if (method === 'HEAD') return response.end();
  fs.createReadStream(filename).pipe(response);
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    if (!response.headersSent) respond(response, error.status || 500, { error: error.status ? error.message : 'An unexpected server error occurred.' });
    else response.destroy();
    if (!error.status) console.error(error);
  });
});

server.listen(PORT, () => {
  console.log(`Brightloop is ready at http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') console.log('Demo accounts: admin@brightloop.io, staff@brightloop.io, olivia@northstar.io · password: Brightloop!2026');
  runBilling();
  setInterval(() => { try { runBilling(); } catch (error) { console.error('Scheduled billing failed.', error); } }, 60 * 60 * 1000).unref();
});
