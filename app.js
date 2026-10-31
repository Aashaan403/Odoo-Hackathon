const state = { user: null, data: null, page: 'overview', toastTimer: null, report: null };
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));
const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';
const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
};

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('toast-error', error);
  element.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('show'), 3200);
}

function authScreen(mode = 'login', message = '') {
  $('#application').hidden = true;
  const view = $('#auth-view');
  view.hidden = false;
  const resetToken = new URLSearchParams(location.search).get('token');
  if (location.pathname === '/reset-password' && resetToken) mode = 'reset';
  const title = { login: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password' }[mode];
  const description = { login: 'Sign in to your subscription workspace.', signup: 'Start managing subscriptions in one place.', forgot: 'We’ll prepare a secure password reset link.', reset: 'Your new password must meet the account rules.' }[mode];
  let fields = '';
  if (mode === 'signup') fields = `<label>Full name<input name="name" required autocomplete="name" placeholder="Alex Morgan" /></label><label>Company <span class="optional">optional</span><input name="company" autocomplete="organization" placeholder="Your company" /></label><label>Email address<input name="email" required type="email" autocomplete="email" placeholder="you@company.com" /></label><label>Password<input name="password" required type="password" autocomplete="new-password" minlength="9" placeholder="At least 9 characters" /><small class="field-help">Use uppercase, lowercase, and a special character.</small></label>`;
  if (mode === 'login') fields = `<label>Email address<input name="email" required type="email" autocomplete="username" placeholder="you@company.com" /></label><label>Password<input name="password" required type="password" autocomplete="current-password" placeholder="Your password" /></label><button class="auth-inline" type="button" data-auth-mode="forgot">Forgot password?</button>`;
  if (mode === 'forgot') fields = `<label>Email address<input name="email" required type="email" autocomplete="email" placeholder="you@company.com" /></label>`;
  if (mode === 'reset') fields = `<input name="token" type="hidden" value="${escapeHtml(resetToken)}" /><label>New password<input name="password" required type="password" autocomplete="new-password" minlength="9" placeholder="At least 9 characters" /><small class="field-help">Use uppercase, lowercase, and a special character.</small></label><label>Confirm password<input name="confirmPassword" required type="password" autocomplete="new-password" minlength="9" placeholder="Repeat your new password" /></label>`;
  const button = { login: 'Sign in', signup: 'Create account', forgot: 'Create reset link', reset: 'Save new password' }[mode];
  view.innerHTML = `<section class="auth-card"><a class="brand auth-brand" href="#"><span class="brand-mark">b</span><span>brightloop</span></a><div class="auth-heading"><span class="eyebrow"><span class="live-dot"></span>SUBSCRIPTION OPERATIONS</span><h1>${title}</h1><p>${description}</p></div>${message ? `<div class="inline-message">${escapeHtml(message)}</div>` : ''}<form id="auth-form" data-auth-form="${mode}">${fields}<button class="button button-primary auth-submit" type="submit">${button}<span>→</span></button></form>${mode === 'login' ? `<div class="demo-access"><strong>Demo access</strong><span>Admin · Staff · Customer</span><code>Brightloop!2026</code><small>admin@brightloop.io<br />staff@brightloop.io<br />olivia@northstar.io</small></div>` : ''}<div class="auth-foot">${mode === 'login' ? `New to Brightloop? <button data-auth-mode="signup">Create an account</button>` : `Already have an account? <button data-auth-mode="login">Sign in</button>`}</div></section>`;
  $$('[data-auth-mode]', view).forEach((buttonEl) => buttonEl.addEventListener('click', () => authScreen(buttonEl.dataset.authMode)));
  $('#auth-form').addEventListener('submit', submitAuth);
}

async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const mode = form.dataset.authForm;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    if (mode === 'login') await api('/auth/login', { method: 'POST', body: JSON.stringify(data) });
    if (mode === 'signup') await api('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
    if (mode === 'forgot') {
      const result = await api('/auth/password-reset', { method: 'POST', body: JSON.stringify(data) });
      authScreen('forgot', result.resetLink ? `Development reset link: ${location.origin}${result.resetLink}` : result.message);
      return;
    }
    if (mode === 'reset') {
      if (data.password !== data.confirmPassword) throw new Error('Passwords do not match.');
      const result = await api('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token: data.token, password: data.password }) });
      history.replaceState({}, '', '/'); authScreen('login', result.message); return;
    }
    history.replaceState({}, '', '/');
    await startApplication();
  } catch (error) { authScreen(mode, error.message); }
  finally { const nextSubmit = $('#auth-form button[type="submit"]'); if (nextSubmit) nextSubmit.disabled = false; }
}

async function startApplication() {
  try {
    const result = await api('/data');
    state.user = result.user; state.data = result; state.page = 'overview';
    $('#auth-view').hidden = true; $('#application').hidden = false;
    renderShell(); renderPage();
  } catch (error) { authScreen('login', error.message); }
}

async function refreshData() {
  state.data = await api('/data');
  renderShell();
  renderPage();
}

function allowedNavigation() {
  if (state.user.role === 'customer') return [{ label: 'MY ACCOUNT', items: [['overview', '◫', 'Overview'], ['plans', '▦', 'Browse plans'], ['subscriptions', '↻', 'My subscriptions'], ['invoices', '▤', 'My invoices']] }];
  const groups = [{ label: 'WORKSPACE', items: [['overview', '◫', 'Overview'], ['subscriptions', '↻', 'Subscriptions'], ['customers', '♙', 'Customers'], ['invoices', '▤', 'Invoices'], ['payments', '⇄', 'Payments'], ['reports', '▥', 'Reports']] }, { label: 'CATALOG', items: [['plans', '▦', 'Plans'], ['products', '◇', 'Products'], ['taxes', '%', 'Taxes'], ['discounts', '％', 'Discounts'], ['quotes', '▧', 'Quote templates']] }];
  if (state.user.role === 'admin') groups.push({ label: 'ADMINISTRATION', items: [['team', '♙', 'Team & access']] });
  return groups;
}

function renderShell() {
  const groups = allowedNavigation();
  $('#sidebar-navigation').innerHTML = groups.map((group) => `<div class="nav-label">${group.label}</div><nav class="main-nav">${group.items.map(([page, icon, label]) => `<button class="nav-item ${state.page === page ? 'active' : ''}" data-page="${page}"><span class="nav-icon">${icon}</span>${label}${page === 'invoices' && state.data.summary.overdue ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>`).join('');
  $$('.nav-item[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = button.dataset.page; renderShell(); renderPage(); }));
  $('#workspace-role').textContent = state.user.role[0].toUpperCase() + state.user.role.slice(1);
  $('#user-name').textContent = state.user.name;
  $('#user-email').textContent = state.user.email;
  $('#user-avatar').textContent = initials(state.user.name);
  $('#top-avatar').textContent = initials(state.user.name);
  $('#today-label').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  $('#logout-button').onclick = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); state.user = null; state.data = null; authScreen('login'); };
}

const pageMeta = {
  overview: ['Overview', 'Your subscription business at a glance.'], subscriptions: ['Subscriptions', 'Manage customer plans and subscription lifecycles.'], customers: ['Customers', 'Your customer directory and account details.'], invoices: ['Invoices', 'Review, send, and collect recurring invoices.'], payments: ['Payments', 'Track payments matched to customer invoices.'], plans: ['Plans', 'Configure billing intervals, availability, and plan policies.'], products: ['Products', 'Manage subscription products and priced variants.'], taxes: ['Taxes', 'Configure tax rules for recurring invoices.'], discounts: ['Discounts', 'Create rules that apply automatically during billing.'], quotes: ['Quote templates', 'Start customer quotations from reusable plan and product lines.'], reports: ['Reports', 'Review revenue collected, balances due, and subscription performance.'], team: ['Team & access', 'Manage internal roles and workspace access.'],
};

function renderPage() {
  const [title, description] = pageMeta[state.page] || pageMeta.overview;
  $('#breadcrumb-page').textContent = title; $('#page-title').textContent = title; $('#page-description').textContent = description;
  const actionTarget = $('#page-actions');
  const privileged = state.user.role !== 'customer';
  const actions = {
    overview: privileged ? `<button class="button button-secondary" data-action="run-billing">↻ Run billing</button><button class="button button-primary" data-open="subscription">＋ New subscription</button>` : `<button class="button button-primary" data-open="subscription">＋ Start subscription</button>`,
    subscriptions: `<button class="button button-primary" data-open="subscription">＋ New subscription</button>`,
    customers: privileged ? `<button class="button button-primary" data-open="customer">＋ Add customer</button>` : '',
    plans: `<button class="button button-primary" data-open="subscription">＋ ${privileged ? 'Create subscription' : 'Subscribe to plan'}</button>${state.user.role === 'admin' ? '<button class="button button-secondary" data-open="plan">＋ New plan</button>' : ''}`,
    products: state.user.role === 'admin' ? `<button class="button button-primary" data-open="product">＋ New product</button>` : '',
    discounts: state.user.role === 'admin' ? `<button class="button button-primary" data-open="discount">＋ New discount</button>` : '',
    taxes: state.user.role === 'admin' ? `<button class="button button-primary" data-open="tax">＋ Add tax rule</button>` : '',
    quotes: privileged ? `<button class="button button-primary" data-open="quote-template">＋ New template</button><button class="button button-secondary" data-open="subscription" data-quote="true">＋ New quotation</button>` : '',
    invoices: privileged ? `<button class="button button-secondary" data-action="run-billing">↻ Run billing</button>` : '',
    team: state.user.role === 'admin' ? `<button class="button button-primary" data-open="staff">＋ Add team member</button>` : '',
  };
  actionTarget.innerHTML = actions[state.page] || '';
  actionTarget.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => openForm(button.dataset.open, {}, button.dataset.quote === 'true')));
  actionTarget.querySelectorAll('[data-action="run-billing"]').forEach((button) => button.addEventListener('click', runBilling));
  const content = $('#app-content');
  const renderers = { overview: renderOverview, subscriptions: renderSubscriptions, customers: renderCustomers, invoices: renderInvoices, payments: renderPayments, plans: renderPlans, products: renderProducts, taxes: renderTaxes, discounts: renderDiscounts, quotes: renderQuotes, reports: renderReports, team: renderTeam };
  content.innerHTML = (renderers[state.page] || renderOverview)();
  bindContentActions(content);
}

function metricCard(label, value, caption, icon, tone) { return `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon ${tone}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${caption}</div></article>`; }
function renderOverview() {
  const { summary, subscriptions, invoices } = state.data;
  const active = subscriptions.filter((item) => item.status === 'Active').length;
  const recentInvoices = invoices.slice().sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 5);
  const recentSubs = subscriptions.slice(0, 5);
  const breakdown = state.data.plans.map((plan) => ({ name: plan.name, count: subscriptions.filter((sub) => sub.planId === plan.id && sub.status === 'Active').length })).filter((item) => item.count).sort((a, b) => b.count - a.count);
  const total = breakdown.reduce((sum, item) => sum + item.count, 0) || 1;
  return `<div class="metric-grid">${metricCard('Monthly recurring revenue', money(summary.mrr), `${active} active subscriptions`, '↗', 'icon-violet')}${metricCard(state.user.role === 'customer' ? 'My subscriptions' : 'Active subscriptions', active, `${subscriptions.length} total subscriptions`, '↻', 'icon-blue')}${metricCard('Payments collected', money(summary.revenue), 'In selected period', '✓', 'icon-green')}${metricCard('Outstanding balance', money(summary.overdue), 'Overdue invoices', '◷', 'icon-orange')}</div><div class="analytics-grid"><article class="panel"><div class="panel-heading"><div><h2>Revenue & collection</h2><p>Payments received and balances still due</p></div><button class="text-link" data-page-link="reports">View report →</button></div><div class="overview-totals"><div><span>Collected</span><strong>${money(summary.revenue)}</strong></div><div><span>Still owed</span><strong>${money(summary.outstanding)}</strong></div><div><span>Overdue</span><strong>${money(summary.overdue)}</strong></div></div><div class="collection-bar"><span style="width:${summary.revenue + summary.outstanding ? Math.max(4, summary.revenue / (summary.revenue + summary.outstanding) * 100) : 0}%"></span></div><div class="chart-legend"><span><i class="legend-dot purple-dot"></i>Collected</span><span><i class="legend-dot gray-dot"></i>Outstanding</span></div></article><article class="panel breakdown-panel"><div class="panel-heading"><div><h2>Plan mix</h2><p>Active subscriptions by plan</p></div></div><div class="plan-breakdown">${breakdown.length ? breakdown.map((item) => `<div class="breakdown-row"><div><span>${escapeHtml(item.name)}</span><strong>${item.count}</strong></div><div class="bar-track"><i style="width:${Math.max(5, item.count / total * 100)}%"></i></div></div>`).join('') : '<div class="empty-state">No active subscriptions yet.</div>'}</div></article></div><div class="two-panels"><section class="panel"><div class="panel-heading"><div><h2>Recent subscriptions</h2><p>Latest customer activity</p></div><button class="text-link" data-page-link="subscriptions">View all →</button></div>${subscriptionTable(recentSubs, true)}</section><section class="panel"><div class="panel-heading"><div><h2>Invoices to watch</h2><p>Outstanding and overdue invoices</p></div><button class="text-link" data-page-link="invoices">View all →</button></div>${invoiceMiniTable(recentInvoices.filter((item) => item.outstanding > 0).slice(0, 5))}</section></div>`;
}

function statusBadge(status) { const key = String(status).toLowerCase().replace(/\s+/g, '-'); return `<span class="status-pill status-${escapeHtml(key)}">${escapeHtml(status)}</span>`; }
function subscriptionTable(rows, compact = false) {
  if (!rows.length) return `<div class="empty-state">No subscriptions yet.</div>`;
  return `<div class="table-scroll"><table><thead><tr><th>SUBSCRIPTION</th>${state.user.role !== 'customer' ? '<th>CUSTOMER</th>' : ''}<th>PLAN</th><th>STATUS</th><th>NEXT BILLING</th><th>AMOUNT</th>${compact ? '' : '<th>ACTIONS</th>'}</tr></thead><tbody>${rows.map((item) => { const customer = item.customer || state.data.customers?.find((c) => c.id === item.customerId); const plan = item.plan || state.data.plans.find((p) => p.id === item.planId); const amount = item.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0); return `<tr><td><span class="sub-id">${escapeHtml(item.number)}</span><small>${escapeHtml(dateLabel(item.startDate))}</small></td>${state.user.role !== 'customer' ? `<td><div class="person"><span class="person-avatar av-violet">${escapeHtml(initials(customer?.name))}</span><span>${escapeHtml(customer?.company || customer?.name || 'Customer')}</span></div></td>` : ''}<td><span class="plan-pill">${escapeHtml(plan?.name || 'Plan')}</span></td><td>${statusBadge(item.status)}</td><td>${escapeHtml(dateLabel(item.nextBillingDate))}</td><td class="amount-cell">${money(amount)} <span class="muted">/ ${escapeHtml(plan?.interval || 'month')}</span></td>${compact ? '' : `<td>${subscriptionActions(item)}</td>`}</tr>`; }).join('')}</tbody></table></div>`;
}
function subscriptionActions(item) {
  const customer = state.user.role === 'customer'; const actions = [];
  if (item.status === 'Draft' && !customer) actions.push(['quotation', 'Make quotation'], ['confirm', 'Confirm']);
  if (item.status === 'Quotation' && !customer) actions.push(['confirm', 'Confirm quote']);
  if (item.status === 'Confirmed' && !customer) actions.push(['activate', 'Activate']);
  if (item.status === 'Active') { if (!customer || state.data.plans.find((p) => p.id === item.planId)?.allowPause) actions.push(['pause', 'Pause']); if (!customer || state.data.plans.find((p) => p.id === item.planId)?.allowEarlyClose) actions.push(['close', 'Close']); }
  if (item.status === 'Paused') actions.push(['resume', 'Resume'], ['close', 'Close']);
  if (item.status === 'Closed' && state.data.plans.find((p) => p.id === item.planId)?.allowRenew) actions.push(['renew', 'Renew']);
  return actions.length ? `<div class="row-actions">${actions.map(([action, label]) => `<button class="action-chip" data-sub-action="${action}" data-id="${item.id}">${label}</button>`).join('')}</div>` : '<span class="muted">—</span>';
}

function invoiceMiniTable(rows) {
  if (!rows.length) return '<div class="empty-state">You’re all caught up. No outstanding invoices.</div>';
  return `<div class="mini-list">${rows.map((invoice) => `<div class="mini-row"><span class="mini-icon">▤</span><div class="mini-main"><strong>${escapeHtml(invoice.number)}</strong><small>${escapeHtml(invoice.customer?.company || invoice.customer?.name || 'Invoice')} · Due ${escapeHtml(dateLabel(invoice.dueDate))}</small></div><div class="mini-amount"><strong>${money(invoice.total)}</strong>${statusBadge(invoice.status)}</div></div>`).join('')}</div>`;
}

function renderSubscriptions() { return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>All subscriptions</h2><p>${state.data.subscriptions.length} subscription records · Actions update lifecycle state</p></div><div class="table-tools"><input class="search-input" id="subscriptions-search" placeholder="Search subscriptions" /><select id="subscription-status"><option value="">All statuses</option>${['Draft', 'Quotation', 'Confirmed', 'Active', 'Paused', 'Closed', 'Trial'].map((s) => `<option>${s}</option>`).join('')}</select></div></div><div id="subscription-table">${subscriptionTable(state.data.subscriptions)}</div></section>`; }
function renderCustomers() { const rows = state.data.customers || []; return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Customer directory</h2><p>${rows.length} customer accounts</p></div><input class="search-input" id="customers-search" placeholder="Search customers" /></div><div class="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>SUBSCRIPTIONS</th><th>OUTSTANDING</th></tr></thead><tbody>${rows.map((customer) => { const subs = state.data.subscriptions.filter((item) => item.customerId === customer.id).length; const balance = state.data.invoices.filter((item) => item.customerId === customer.id).reduce((sum, invoice) => sum + invoice.outstanding, 0); return `<tr data-search-row><td><div class="person"><span class="person-avatar av-blue">${escapeHtml(initials(customer.name))}</span><span>${escapeHtml(customer.company || customer.name)}</span></div><small>${escapeHtml(customer.name)}</small></td><td>${escapeHtml(customer.email)}</td><td>${escapeHtml(customer.phone || '—')}</td><td>${subs}</td><td class="amount-cell">${money(balance)}</td></tr>`; }).join('')}</tbody></table></div></section>`; }

function renderInvoices() {
  const rows = state.data.invoices;
  return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Invoice register</h2><p>${rows.length} invoices · Drafts, confirmed balances, and payments</p></div><div class="table-tools"><input id="invoice-search" class="search-input" placeholder="Search invoices" /><select id="invoice-status"><option value="">All statuses</option><option>Draft</option><option>Confirmed</option><option>Paid</option><option>Overdue</option></select></div></div><div class="table-scroll"><table><thead><tr><th>INVOICE</th>${state.user.role !== 'customer' ? '<th>CUSTOMER</th>' : ''}<th>ISSUED</th><th>DUE DATE</th><th>STATUS</th><th>TOTAL</th><th>OUTSTANDING</th><th>ACTIONS</th></tr></thead><tbody>${rows.map((invoice) => `<tr data-invoice-row><td><span class="sub-id">${escapeHtml(invoice.number)}</span><small>${escapeHtml(invoice.subscription?.number || '')}</small></td>${state.user.role !== 'customer' ? `<td>${escapeHtml(invoice.customer?.company || invoice.customer?.name || '')}</td>` : ''}<td>${escapeHtml(dateLabel(invoice.issueDate))}</td><td>${escapeHtml(dateLabel(invoice.dueDate))}</td><td>${statusBadge(invoice.status)}</td><td class="amount-cell">${money(invoice.total)}</td><td class="amount-cell">${money(invoice.outstanding)}</td><td><div class="row-actions">${invoice.status === 'Draft' && state.user.role !== 'customer' ? `<button class="action-chip" data-invoice-action="confirm" data-id="${invoice.id}">Confirm</button>` : ''}${invoice.outstanding > 0 && state.user.role !== 'customer' ? `<button class="action-chip" data-payment="${invoice.id}">Record payment</button>` : ''}${invoice.status !== 'Paid' && state.user.role !== 'customer' ? `<button class="action-chip" data-invoice-action="send" data-id="${invoice.id}">Send</button>` : ''}<button class="action-chip" data-print-invoice="${invoice.id}">Print</button>${invoice.status !== 'Paid' && state.user.role !== 'customer' ? `<button class="action-chip action-danger" data-invoice-action="cancel" data-id="${invoice.id}">Cancel</button>` : ''}</div></td></tr>`).join('')}</tbody></table>${rows.length ? '' : '<div class="empty-state">Invoices will appear here when billing runs.</div>'}</div></section>`;
}

function renderPayments() {
  const rows = state.data.payments;
  return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Payment history</h2><p>${rows.length} recorded payments</p></div><input class="search-input" id="payments-search" placeholder="Search payment or invoice" /></div><div class="table-scroll"><table><thead><tr><th>PAYMENT</th><th>INVOICE</th><th>METHOD</th><th>DATE</th><th>NOTE</th><th>AMOUNT</th></tr></thead><tbody>${rows.map((payment) => { const invoice = state.data.invoices.find((item) => item.id === payment.invoiceId); return `<tr data-payment-row><td><span class="sub-id">${escapeHtml(payment.id.toUpperCase())}</span></td><td>${escapeHtml(invoice?.number || 'Invoice')}</td><td><span class="plan-pill">${escapeHtml(payment.method)}</span></td><td>${escapeHtml(dateLabel(payment.date))}</td><td>${escapeHtml(payment.note || '—')}</td><td class="amount-cell">${money(payment.amount)}</td></tr>`; }).join('')}</tbody></table>${rows.length ? '' : '<div class="empty-state">Payments recorded against invoices will appear here.</div>'}</div></section>`;
}

function renderPlans() {
  const plans = state.data.plans;
  return `<div class="catalog-grid">${plans.map((plan) => { const product = state.data.products.find((item) => item.id === plan.productId); return `<article class="panel catalog-card"><div class="catalog-top"><span class="catalog-icon">▦</span>${statusBadge(plan.active ? 'Active' : 'Archived')}</div><h2>${escapeHtml(plan.name)}</h2><p>${escapeHtml(product?.name || 'Product')}</p><div class="plan-price">${money(plan.price)}<small> / ${escapeHtml(plan.interval)}</small></div><div class="catalog-details"><span>Minimum quantity</span><strong>${plan.minQuantity} seat${plan.minQuantity === 1 ? '' : 's'}</strong><span>Available from</span><strong>${escapeHtml(dateLabel(plan.availableFrom))}</strong><span>End behavior</span><strong>${plan.autoClose ? 'Closes automatically' : 'Renews until closed'}</strong></div>${state.user.role === 'admin' ? `<div class="catalog-actions"><button class="action-chip" data-edit-plan="${plan.id}">Edit plan</button><button class="action-chip" data-toggle-plan="${plan.id}">${plan.active ? 'Archive' : 'Activate'}</button></div>` : `<button class="button button-primary full-button" data-open="subscription" data-plan="${plan.id}">Choose this plan</button>`}</article>`; }).join('')}${state.user.role === 'admin' ? '<button class="add-card" data-open="plan">＋<span>Create a plan</span></button>' : ''}</div>`;
}

function renderProducts() {
  const products = state.data.products;
  return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Products</h2><p>Product pricing, costs, and purchasable variants</p></div></div><div class="table-scroll"><table><thead><tr><th>PRODUCT</th><th>TYPE</th><th>SALES PRICE</th><th>COST PRICE</th><th>VARIANTS</th><th>STATUS</th><th></th></tr></thead><tbody>${products.map((product) => `<tr><td><strong class="row-title">${escapeHtml(product.name)}</strong><small>${escapeHtml(product.notes || '')}</small></td><td>${escapeHtml(product.type)}</td><td>${money(product.salesPrice)}</td><td>${money(product.costPrice)}</td><td>${product.variants?.length ? product.variants.map((v) => `${escapeHtml(v.name)} (+${money(v.priceDelta)})`).join('<br>') : '—'}</td><td>${statusBadge(product.active ? 'Active' : 'Archived')}</td><td>${state.user.role === 'admin' ? `<button class="action-chip" data-edit-product="${product.id}">Edit</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function renderTaxes() {
  return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Tax rules</h2><p>Active taxes are calculated on every recurring invoice.</p></div></div><div class="table-scroll"><table><thead><tr><th>TAX NAME</th><th>RATE</th><th>STATUS</th><th></th></tr></thead><tbody>${state.data.taxes.map((tax) => `<tr><td><strong class="row-title">${escapeHtml(tax.name)}</strong></td><td>${Number(tax.rate).toFixed(2)}%</td><td>${statusBadge(tax.active ? 'Active' : 'Paused')}</td><td><button class="action-chip" data-toggle-tax="${tax.id}">${tax.active ? 'Disable' : 'Enable'}</button></td></tr>`).join('')}</tbody></table>${state.data.taxes.length ? '' : '<div class="empty-state">Add a tax rule to calculate invoice totals automatically.</div>'}</div></section>`;
}

function renderDiscounts() {
  return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Discount rules</h2><p>Rules are applied automatically when a subscription is billed.</p></div></div><div class="table-scroll"><table><thead><tr><th>RULE</th><th>VALUE</th><th>APPLIES TO</th><th>MINIMUM</th><th>VALID DATES</th><th>USES</th><th>STATUS</th></tr></thead><tbody>${state.data.discounts.map((item) => `<tr><td><strong class="row-title">${escapeHtml(item.name)}</strong></td><td>${item.type === 'percentage' ? `${item.value}%` : money(item.value)}</td><td>${escapeHtml(item.scope)}</td><td>${money(item.minimumPurchase)} · ${item.minimumQuantity} qty</td><td>${escapeHtml(item.startDate || 'Any')} – ${escapeHtml(item.endDate || 'No end')}</td><td>${item.usedCount}${item.maxUses ? ` / ${item.maxUses}` : ' / ∞'}</td><td>${statusBadge(item.active ? 'Active' : 'Paused')}</td></tr>`).join('')}</tbody></table>${state.data.discounts.length ? '' : '<div class="empty-state">No discount rules. Add one to automatically price the next invoice.</div>'}</div></section>`;
}

function renderQuotes() {
  return `<div class="quote-intro panel"><div><span class="catalog-icon">▧</span><h2>Start with a reusable quote</h2><p>Choose a template to create a customer quotation with a validity period and product lines already filled in.</p></div><button class="button button-primary" data-open="subscription" data-quote="true">＋ Create quotation</button></div><section class="panel activity-panel"><div class="panel-heading"><div><h2>Quotation templates</h2><p>${state.data.quoteTemplates.length} reusable templates</p></div></div><div class="template-grid">${state.data.quoteTemplates.map((template) => { const plan = state.data.plans.find((item) => item.id === template.planId); return `<article class="template-card"><div class="template-icon">▧</div><h3>${escapeHtml(template.name)}</h3><p>${escapeHtml(plan?.name || 'Plan')} · Valid for ${template.validityDays} days</p><div class="template-line">${template.lines.map((line) => `${escapeHtml(state.data.products.find((p) => p.id === line.productId)?.name || 'Product')} × ${line.quantity}`).join('<br>')}</div><button class="action-chip" data-new-quote="${template.id}">Create quote from template →</button></article>`; }).join('')}</div>${state.data.quoteTemplates.length ? '' : '<div class="empty-state">Create a template to speed up sales quotations.</div>'}</section><section class="panel activity-panel"><div class="panel-heading"><div><h2>Open quotations</h2><p>Drafts and customer offers currently in progress.</p></div></div>${subscriptionTable(state.data.subscriptions.filter((item) => ['Draft', 'Quotation', 'Confirmed'].includes(item.status)))}</section>`;
}

function renderReports() {
  const from = new Date(); from.setDate(1); const start = from.toISOString().slice(0, 10); const end = new Date().toISOString().slice(0, 10);
  return `<section class="panel report-filters"><div><span class="eyebrow">REVENUE SUMMARY</span><h2>Financial overview</h2><p>Filter collected revenue and invoice balances by issue date.</p></div><div class="table-tools"><label>From<input id="report-from" type="date" value="${start}" /></label><label>To<input id="report-to" type="date" value="${end}" /></label><button class="button button-secondary" id="apply-report">Apply</button><button class="button button-secondary" id="export-report">⇩ Export CSV</button></div></section>${reportCards(state.report || state.data.summary)}<section class="panel activity-panel"><div class="panel-heading"><div><h2>Invoice details</h2><p>Outstanding amounts and payment status</p></div></div><div class="table-scroll"><table><thead><tr><th>INVOICE</th><th>ISSUED</th><th>DUE</th><th>STATUS</th><th>AMOUNT DUE</th></tr></thead><tbody>${(state.report?.invoices || state.data.invoices).map((item) => `<tr><td class="sub-id">${escapeHtml(item.number)}</td><td>${escapeHtml(dateLabel(item.issueDate))}</td><td>${escapeHtml(dateLabel(item.dueDate))}</td><td>${statusBadge(item.status)}</td><td class="amount-cell">${money(item.outstanding)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function reportCards(report) { return `<div class="metric-grid report-metrics">${metricCard('Active subscriptions', report.activeSubscriptions, 'Current active plans', '↻', 'icon-blue')}${metricCard('Monthly recurring revenue', money(report.mrr), 'Normalized monthly value', '↗', 'icon-violet')}${metricCard('Payments collected', money(report.revenue), 'Payments in selected period', '✓', 'icon-green')}${metricCard('Outstanding / overdue', `${money(report.outstanding)} / ${money(report.overdue)}`, 'Open invoice balance', '◷', 'icon-orange')}</div>`; }

function renderTeam() { const users = state.data.users || []; return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Workspace members</h2><p>Only administrators can add internal team members.</p></div></div><div class="table-scroll"><table><thead><tr><th>MEMBER</th><th>EMAIL</th><th>ROLE</th><th>ACCESS</th></tr></thead><tbody>${users.map((item) => `<tr><td><div class="person"><span class="person-avatar av-violet">${escapeHtml(initials(item.name))}</span><span>${escapeHtml(item.name)}</span></div></td><td>${escapeHtml(item.email)}</td><td>${statusBadge(item.role)}</td><td>${item.role === 'customer' ? 'Customer portal' : 'Internal workspace'}</td></tr>`).join('')}</tbody></table></div></section>`; }

function openForm(type, record = {}, quote = false) {
  const products = state.data.products.filter((item) => item.active); const plans = state.data.plans.filter((item) => item.active); const customers = state.data.customers || []; const taxes = state.data.taxes.filter((item) => item.active); const templates = state.data.quoteTemplates;
  const input = (label, name, value = '', opts = {}) => `<label>${label}<input name="${name}" value="${escapeHtml(value)}" ${opts.type ? `type="${opts.type}"` : ''} ${opts.required === false ? '' : 'required'} ${opts.min !== undefined ? `min="${opts.min}"` : ''} ${opts.step ? `step="${opts.step}"` : ''} placeholder="${escapeHtml(opts.placeholder || '')}" /></label>`;
  const select = (label, name, options, selected = '') => `<label>${label}<select name="${name}" required>${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
  let title = ''; let formFields = ''; let endpoint = ''; let method = 'POST'; let extra = {};
  if (type === 'customer') { title = 'Add customer'; endpoint = '/customers'; formFields = `${input('Contact name', 'name')}${input('Company', 'company', '', { required: false })}${input('Email', 'email', '', { type: 'email' })}${input('Phone', 'phone', '', { required: false })}`; }
  if (type === 'product') { title = record.id ? 'Edit product' : 'Create product'; endpoint = `/products${record.id ? `/${record.id}` : ''}`; method = record.id ? 'PATCH' : 'POST'; const variantText = (record.variants || []).map((variant) => `${variant.name}:${variant.priceDelta}`).join(', '); formFields = `${input('Product name', 'name', record.name || '')}${select('Product type', 'type', [['service', 'Service'], ['subscription', 'Subscription'], ['goods', 'Goods']], record.type || 'service')}<div class="form-row">${input('Sales price', 'salesPrice', record.salesPrice ?? '', { type: 'number', min: 0, step: '0.01' })}${input('Cost price', 'costPrice', record.costPrice ?? '', { type: 'number', min: 0, step: '0.01' })}</div>${input('Notes', 'notes', record.notes || '', { required: false, placeholder: 'What is included?' })}${input('Variants', 'variantsText', variantText, { required: false, placeholder: 'Standard:0, Odoo:560' })}<small class="field-help">Enter comma separated variant names and price changes.</small>`; }
  if (type === 'tax') { title = 'Add tax rule'; endpoint = '/taxes'; formFields = `${input('Tax name', 'name')}${input('Tax rate (%)', 'rate', '', { type: 'number', min: 0, step: '0.01' })}`; }
  if (type === 'plan') { title = record.id ? 'Edit plan' : 'Create plan'; endpoint = `/plans${record.id ? `/${record.id}` : ''}`; method = record.id ? 'PATCH' : 'POST'; formFields = `${input('Plan name', 'name', record.name || '')}${select('Product', 'productId', products.map((p) => [p.id, p.name]), record.productId || products[0]?.id)}<div class="form-row">${input('Price per billing period', 'price', record.price ?? '', { type: 'number', min: 0, step: '0.01' })}${select('Billing frequency', 'interval', [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']], record.interval || 'monthly')}</div><div class="form-row">${input('Minimum quantity', 'minQuantity', record.minQuantity || 1, { type: 'number', min: 1 })}${input('Available from', 'availableFrom', record.availableFrom || new Date().toISOString().slice(0, 10), { type: 'date' })}</div>${input('Available until', 'availableTo', record.availableTo || '', { type: 'date', required: false })}<div class="check-grid"><label><input type="checkbox" name="autoClose" ${record.autoClose ? 'checked' : ''} /> Close when plan ends</label><label><input type="checkbox" name="allowEarlyClose" ${record.allowEarlyClose ? 'checked' : ''} /> Allow early close</label><label><input type="checkbox" name="allowPause" ${record.allowPause ? 'checked' : ''} /> Allow pause</label><label><input type="checkbox" name="allowRenew" ${record.allowRenew !== false ? 'checked' : ''} /> Allow renewal</label></div>`; }
  if (type === 'discount') { title = 'Create discount rule'; endpoint = '/discounts'; formFields = `${input('Rule name', 'name')}${select('Discount type', 'type', [['percentage', 'Percentage'], ['fixed', 'Fixed amount']])}<div class="form-row">${input('Value', 'value', '', { type: 'number', min: 0, step: '0.01' })}${select('Applies to', 'scope', [['subscriptions', 'Whole subscription'], ['products', 'Selected products']])}</div><div class="form-row">${input('Minimum purchase', 'minimumPurchase', 0, { type: 'number', min: 0, step: '0.01' })}${input('Minimum quantity', 'minimumQuantity', 1, { type: 'number', min: 1 })}</div><div class="form-row">${input('Starts', 'startDate', new Date().toISOString().slice(0, 10), { type: 'date' })}${input('Ends', 'endDate', '', { type: 'date', required: false })}</div>${input('Maximum uses (0 = unlimited)', 'maxUses', 0, { type: 'number', min: 0 })}<label>Products <select name="productIds" multiple>${products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></label>`; }
  if (type === 'quote-template') { title = 'Create quote template'; endpoint = '/quote-templates'; formFields = `${input('Template name', 'name')}${select('Plan', 'planId', plans.map((p) => [p.id, p.name]))}<div class="form-row">${input('Validity (days)', 'validityDays', 30, { type: 'number', min: 1 })}${input('Line quantity', 'quantity', '', { type: 'number', min: 1 })}</div>`; }
  if (type === 'staff') { title = 'Add team member'; endpoint = '/users'; formFields = `${input('Full name', 'name')}${input('Email', 'email', '', { type: 'email' })}${select('Workspace role', 'role', [['staff', 'Staff'], ['admin', 'Admin']])}${input('Temporary password', 'password', '', { type: 'password', placeholder: 'Uppercase, lowercase, special character' })}<small class="field-help">The team member can reset this password from sign in.</small>`; }
  if (type === 'subscription') {
    title = quote ? 'Create quotation' : 'Create subscription'; endpoint = '/subscriptions';
    const preselectedTemplate = record.templateId || (quote ? (templates[0]?.id || '') : '');
    const templatePlan = plans.find((p) => p.id === templates.find((item) => item.id === preselectedTemplate)?.planId);
    formFields = `${state.user.role !== 'customer' ? select('Customer', 'customerId', customers.map((item) => [item.id, `${item.company || item.name} · ${item.email}`])) : ''}${quote ? select('Quotation template', 'templateId', templates.map((item) => [item.id, `${item.name} (${item.validityDays} days)`]), preselectedTemplate) : ''}${select('Plan', 'planId', plans.map((item) => [item.id, `${item.name} · ${money(item.price)} / ${item.interval}`]), record.planId || templatePlan?.id || plans[0]?.id)}<div class="form-row">${input('Start date', 'startDate', new Date().toISOString().slice(0, 10), { type: 'date' })}${input('Expiry date', 'expiryDate', '', { type: 'date', required: false })}</div><div class="form-row">${input('Payment terms (days)', 'paymentTermsDays', 15, { type: 'number', min: 0 })}${select('Discount', 'discountId', [['', 'No discount'], ...state.data.discounts.map((item) => [item.id, item.name])], '')}</div><div class="form-row">${select('Product variant', 'variant', [['', 'Default price']])}${input('Quantity', 'quantity', plans.find((p) => p.id === (record.planId || templatePlan?.id || plans[0]?.id))?.minQuantity || 1, { type: 'number', min: 1 })}</div><small class="field-help">Plan availability and minimum quantities are checked before saving.</small>`;
    extra = { quote };
  }
  if (type === 'payment') { title = 'Record payment'; endpoint = `/invoices/${record.invoiceId}/payments`; formFields = `<div class="payment-context"><strong>${escapeHtml(record.number)}</strong><span>Outstanding ${money(record.outstanding)}</span></div><div class="form-row">${input('Amount', 'amount', record.outstanding, { type: 'number', min: 0.01, step: '0.01' })}${select('Method', 'method', [['card', 'Card'], ['bank transfer', 'Bank transfer'], ['cash', 'Cash'], ['direct debit', 'Direct debit'], ['other', 'Other']])}</div>${input('Payment date', 'date', new Date().toISOString().slice(0, 10), { type: 'date' })}${input('Note', 'note', '', { required: false })}`; }
  const dialog = $('#entity-dialog');
  $('#dialog-content').innerHTML = `<form id="entity-form" data-endpoint="${endpoint}" data-method="${method}" data-kind="${type}" data-extra="${extra.quote ? 'quote' : ''}"><div class="modal-head"><div><span class="modal-eyebrow">BRIGHTLOOP WORKSPACE</span><h2>${title}</h2><p>Fields marked required are needed to continue.</p></div><button class="close-modal" type="button" data-close-modal aria-label="Close">×</button></div>${formFields}<div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Cancel</button><button type="submit" class="button button-primary">Save</button></div></form>`;
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  $('#entity-form').addEventListener('submit', submitEntity);
  const activeForm = $('#entity-form');
  if (type === 'subscription') {
    const planSelect = activeForm.elements.planId; const templateSelect = activeForm.elements.templateId; const variantSelect = activeForm.elements.variant; const quantityInput = activeForm.elements.quantity;
    const updatePlanOptions = () => {
      const plan = state.data.plans.find((item) => item.id === planSelect.value); const product = state.data.products.find((item) => item.id === plan?.productId);
      variantSelect.innerHTML = `<option value="">Default price</option>${(product?.variants || []).map((variant) => `<option value="${product.id}|${escapeHtml(variant.name)}|${Number(variant.priceDelta)}">${escapeHtml(variant.name)} (${variant.priceDelta >= 0 ? '+' : ''}${money(variant.priceDelta)})</option>`).join('')}`;
      quantityInput.min = String(plan?.minQuantity || 1); quantityInput.value = String(Math.max(Number(quantityInput.value || 1), Number(plan?.minQuantity || 1)));
    };
    planSelect?.addEventListener('change', updatePlanOptions);
    templateSelect?.addEventListener('change', () => { const template = templates.find((item) => item.id === templateSelect.value); if (template) planSelect.value = template.planId; updatePlanOptions(); });
    updatePlanOptions();
  }
  dialog.showModal();
}

async function submitEntity(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); const kind = form.dataset.kind;
  const button = $('button[type="submit"]', form); button.disabled = true;
  try {
    let payload = {};
    if (kind === 'customer') payload = data;
    if (kind === 'product') { payload = { ...data, salesPrice: Number(data.salesPrice), costPrice: Number(data.costPrice), variants: String(data.variantsText || '').split(',').filter(Boolean).map((entry) => { const [name, delta = 0] = entry.split(':'); return { name: name.trim(), priceDelta: Number(delta) || 0 }; }) }; }
    if (kind === 'plan') { payload = { ...data, price: Number(data.price), minQuantity: Number(data.minQuantity), autoClose: form.elements.autoClose.checked, allowEarlyClose: form.elements.allowEarlyClose.checked, allowPause: form.elements.allowPause.checked, allowRenew: form.elements.allowRenew.checked }; if (!payload.availableTo) payload.availableTo = ''; }
    if (kind === 'discount') payload = { ...data, value: Number(data.value), minimumPurchase: Number(data.minimumPurchase), minimumQuantity: Number(data.minimumQuantity), maxUses: Number(data.maxUses), productIds: [...form.elements.productIds.selectedOptions].map((option) => option.value) };
    if (kind === 'quote-template') { const plan = state.data.plans.find((item) => item.id === data.planId); payload = { name: data.name, planId: data.planId, validityDays: Number(data.validityDays), lines: [{ productId: plan.productId, quantity: Number(data.quantity || plan.minQuantity), unitPrice: plan.price, taxIds: state.data.taxes.filter((tax) => tax.active).map((tax) => tax.id) }] }; }
    if (kind === 'staff') payload = { ...data };
    if (kind === 'tax') payload = { name: data.name, rate: Number(data.rate) };
    if (kind === 'subscription') {
      const plan = state.data.plans.find((item) => item.id === data.planId);
      const product = state.data.products.find((item) => item.id === plan.productId);
      let variantName = ''; let variantDelta = 0; let variantProductId = product.id;
      if (data.variant) [variantProductId, variantName, variantDelta] = data.variant.split('|');
      const productId = variantProductId || product.id;
      const selectedTemplate = form.dataset.extra === 'quote' ? (data.templateId || '') : '';
      payload = { customerId: data.customerId, planId: data.planId, templateId: selectedTemplate || undefined, startDate: data.startDate, expiryDate: data.expiryDate, paymentTermsDays: Number(data.paymentTermsDays || 15), discountId: data.discountId, lines: selectedTemplate ? undefined : [{ productId, description: product.name, quantity: Number(data.quantity || plan.minQuantity), unitPrice: Number(plan.price) + Number(variantDelta || 0), variant: variantName, taxIds: state.data.taxes.filter((tax) => tax.active).map((tax) => tax.id) }] };
      if (!payload.expiryDate) delete payload.expiryDate;
    }
    if (kind === 'payment') payload = { ...data, amount: Number(data.amount) };
    const response = await api(form.dataset.endpoint, { method: form.dataset.method, body: JSON.stringify(payload) });
    $('#entity-dialog').close(); await refreshData(); toast(kind === 'payment' ? 'Payment recorded and matched to the invoice.' : `${kind === 'subscription' ? (form.dataset.extra ? 'Quotation' : 'Subscription') : kind.replace('-', ' ')} saved.`);
  } catch (error) { toast(error.message, true); button.disabled = false; }
}

function bindContentActions(content) {
  $$('[data-open]', content).forEach((button) => button.addEventListener('click', () => { const planId = button.dataset.plan || ''; openForm(button.dataset.open, { planId }, button.dataset.quote === 'true'); }));
  $$('[data-page-link]', content).forEach((button) => button.addEventListener('click', () => { state.page = button.dataset.pageLink; renderShell(); renderPage(); }));
  $$('[data-new-quote]', content).forEach((button) => button.addEventListener('click', () => openForm('subscription', { templateId: button.dataset.newQuote }, true)));
  $$('[data-edit-plan]', content).forEach((button) => button.addEventListener('click', () => openForm('plan', state.data.plans.find((item) => item.id === button.dataset.editPlan))));
  $$('[data-edit-product]', content).forEach((button) => button.addEventListener('click', () => openForm('product', state.data.products.find((item) => item.id === button.dataset.editProduct))));
  $$('[data-toggle-tax]', content).forEach((button) => button.addEventListener('click', async () => { try { const tax = state.data.taxes.find((item) => item.id === button.dataset.toggleTax); await api(`/taxes/${tax.id}`, { method: 'PATCH', body: JSON.stringify({ active: !tax.active }) }); await refreshData(); } catch (error) { toast(error.message, true); } }));
  $$('[data-toggle-plan]', content).forEach((button) => button.addEventListener('click', async () => { try { const plan = state.data.plans.find((item) => item.id === button.dataset.togglePlan); await api(`/plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ active: !plan.active }) }); await refreshData(); } catch (error) { toast(error.message, true); } }));
  $$('[data-sub-action]', content).forEach((button) => button.addEventListener('click', async () => { try { await api(`/subscriptions/${button.dataset.id}/action`, { method: 'POST', body: JSON.stringify({ action: button.dataset.subAction }) }); await refreshData(); toast(`Subscription ${button.dataset.subAction}d.`); } catch (error) { toast(error.message, true); } }));
  $$('[data-invoice-action]', content).forEach((button) => button.addEventListener('click', async () => { try { await api(`/invoices/${button.dataset.id}/action`, { method: 'POST', body: JSON.stringify({ action: button.dataset.invoiceAction }) }); await refreshData(); toast(`Invoice ${button.dataset.invoiceAction}ed.`); } catch (error) { toast(error.message, true); } }));
  $$('[data-payment]', content).forEach((button) => { const invoice = state.data.invoices.find((item) => item.id === button.dataset.payment); button.addEventListener('click', () => openForm('payment', { ...invoice, invoiceId: invoice.id })); });
  $$('[data-print-invoice]', content).forEach((button) => button.addEventListener('click', () => printInvoice(state.data.invoices.find((item) => item.id === button.dataset.printInvoice))));
  bindSearch('#subscriptions-search', '#subscription-table tbody tr', (row, value) => row.textContent.toLowerCase().includes(value));
  const statusFilter = $('#subscription-status', content); if (statusFilter) statusFilter.addEventListener('change', () => { const rows = state.data.subscriptions.filter((item) => !statusFilter.value || item.status === statusFilter.value); $('#subscription-table').innerHTML = subscriptionTable(rows); bindContentActions($('#app-content')); });
  bindSearch('#customers-search', 'tr[data-search-row]', (row, value) => row.textContent.toLowerCase().includes(value));
  bindSearch('#invoice-search', 'tr[data-invoice-row]', (row, value) => row.textContent.toLowerCase().includes(value));
  bindSearch('#payments-search', 'tr[data-payment-row]', (row, value) => row.textContent.toLowerCase().includes(value));
  const invoiceStatus = $('#invoice-status', content); if (invoiceStatus) invoiceStatus.addEventListener('change', () => $$('#app-content tr[data-invoice-row]').forEach((row) => { row.hidden = invoiceStatus.value && !row.children[4]?.textContent.includes(invoiceStatus.value); }));
  $('#apply-report', content)?.addEventListener('click', async () => { try { const from = $('#report-from').value; const to = $('#report-to').value; state.report = await api(`/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); renderPage(); } catch (error) { toast(error.message, true); } });
  $('#export-report', content)?.addEventListener('click', () => downloadCsv('brightloop-revenue-report.csv', state.report?.invoices || state.data.invoices, ['number', 'issueDate', 'dueDate', 'status', 'total', 'outstanding']));
}

function bindSearch(inputSelector, rowSelector, predicate) { const input = $(inputSelector); if (input) input.addEventListener('input', () => $$(rowSelector).forEach((row) => { row.hidden = !predicate(row, input.value.toLowerCase()); })); }
function downloadCsv(filename, rows, fields) { const csv = [fields.join(','), ...rows.map((row) => fields.map((key) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(','))].join('\r\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }

async function runBilling() { try { const result = await api('/billing/run', { method: 'POST', body: '{}' }); await refreshData(); toast(result.created ? `Billing created ${result.created} invoice${result.created === 1 ? '' : 's'}.` : 'No subscriptions are due for billing.'); } catch (error) { toast(error.message, true); } }
function printInvoice(invoice) {
  if (!invoice) return;
  const popup = window.open('', '_blank', 'width=800,height=900');
  if (!popup) return toast('Allow pop-ups to print this invoice.', true);
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(invoice.number)}</title><style>body{font:14px Arial,sans-serif;color:#29283c;padding:48px;max-width:760px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:2px solid #7658e8;padding-bottom:22px}h1{font-size:26px}table{width:100%;border-collapse:collapse;margin:35px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #ddd}td:last-child,th:last-child{text-align:right}.total{text-align:right;font-size:20px;font-weight:bold}.muted{color:#777}</style></head><body><header><div><strong>brightloop</strong><h1>Invoice ${escapeHtml(invoice.number)}</h1></div><div><div>Issued: ${escapeHtml(dateLabel(invoice.issueDate))}</div><div>Due: ${escapeHtml(dateLabel(invoice.dueDate))}</div></div></header><p>Bill to: ${escapeHtml(invoice.customer?.company || invoice.customer?.name || '')}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${invoice.lines.map((line) => `<tr><td>${escapeHtml(line.description)}</td><td>${line.quantity}</td><td>${money(line.unitPrice)}</td><td>${money(line.amount)}</td></tr>`).join('')}</tbody></table><p class="muted">Subtotal ${money(invoice.subtotal)} · Discount ${money(invoice.discountAmount)} · Tax ${money(invoice.taxAmount)}</p><div class="total">Total ${money(invoice.total)}</div><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

(async function initialize() {
  if (location.pathname === '/reset-password' && new URLSearchParams(location.search).has('token')) { authScreen('reset'); return; }
  try { const session = await api('/session'); if (session.user) { await startApplication(); return; } } catch { /* Server not started; show sign in to explain. */ }
  authScreen('login');
})();
