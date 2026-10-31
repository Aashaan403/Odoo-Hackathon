const initialSubscriptions = [
  { id: 'SUB-0248', customer: 'Olivia Rhye', email: 'olivia@northstar.io', initials: 'OR', color: 'av-blue', plan: 'Business', status: 'Active', billing: 'Nov 12, 2026', amount: 149 },
  { id: 'SUB-0247', customer: 'Phoenix Baker', email: 'phoenix@baker.co', initials: 'PB', color: 'av-pink', plan: 'Starter', status: 'Trial', billing: 'Nov 12, 2026', amount: 49 },
  { id: 'SUB-0246', customer: 'Lana Steiner', email: 'lana@client.co', initials: 'LS', color: 'av-green', plan: 'Enterprise', status: 'Active', billing: 'Nov 11, 2026', amount: 399 },
  { id: 'SUB-0245', customer: 'Demi Wilkinson', email: 'demi@wilkinson.io', initials: 'DW', color: 'av-orange', plan: 'Business', status: 'Past due', billing: 'Nov 10, 2026', amount: 149 },
  { id: 'SUB-0244', customer: 'Candice Wu', email: 'candice@wu.design', initials: 'CW', color: 'av-violet', plan: 'Starter', status: 'Active', billing: 'Nov 09, 2026', amount: 49 },
];
let subscriptions = [...initialSubscriptions];
let statusFilter = 'All statuses';
let nextId = 243;
const body = document.querySelector('#subscriptions-body');
const searchInput = document.querySelector('#table-search');
const dialog = document.querySelector('#create-dialog');
const form = document.querySelector('#subscription-form');
const toast = document.querySelector('#toast');
let toastTimeout;

function renderSubscriptions() {
  const search = searchInput.value.trim().toLowerCase();
  const rows = subscriptions.filter((item) => {
    const matchesSearch = [item.id, item.customer, item.email, item.plan, item.status].some((value) => value.toLowerCase().includes(search));
    const matchesStatus = statusFilter === 'All statuses' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  document.querySelector('#table-count').textContent = rows.length === subscriptions.length
    ? `Showing ${Math.min(rows.length, 5)} of 1,284 subscriptions`
    : `Showing ${rows.length} matching subscription${rows.length === 1 ? '' : 's'}`;
  if (!rows.length) {
    body.innerHTML = '<tr><td class="empty-state" colspan="8">No subscriptions match your search.</td></tr>';
    return;
  }
  body.innerHTML = rows.slice(0, 8).map((item) => {
    const statusClass = item.status === 'Active' ? 'status-active' : item.status === 'Trial' ? 'status-trial' : 'status-past';
    return `<tr><td><input type="checkbox" aria-label="Select ${item.id}" /></td><td><span class="sub-id">${escapeHtml(item.id)}</span></td><td><div class="person"><span class="person-avatar ${item.color}">${escapeHtml(item.initials)}</span><span>${escapeHtml(item.customer)}</span></div></td><td><span class="plan-pill">${escapeHtml(item.plan)}</span></td><td><span class="status-pill ${statusClass}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.billing)}</td><td class="amount-cell">$${Number(item.amount).toFixed(2)} <span class="muted">/ month</span></td><td><button class="row-menu" data-subscription="${escapeHtml(item.id)}" aria-label="Actions for ${escapeHtml(item.id)}">···</button></td></tr>`;
  }).join('');
  body.querySelectorAll('.row-menu').forEach((button) => button.addEventListener('click', () => showToast(`Subscription ${button.dataset.subscription} · Actions coming soon`)));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2600);
}

searchInput.addEventListener('input', renderSubscriptions);
document.querySelector('#create-button').addEventListener('click', () => {
  form.reset();
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  dialog.showModal();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const customer = String(data.get('customer')).trim();
  const amount = Number(data.get('amount'));
  const date = new Date(`${data.get('date')}T12:00:00`);
  if (!customer || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(date.getTime())) {
    showToast('Add a customer, valid amount, and start date.');
    return;
  }
  const initials = customer.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const nextBill = new Date(date);
  if (data.get('cycle') === 'Yearly') nextBill.setFullYear(nextBill.getFullYear() + 1);
  else nextBill.setMonth(nextBill.getMonth() + 1);
  const billing = nextBill.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  subscriptions.unshift({ id: `SUB-${String(nextId--).padStart(4, '0')}`, customer, email: '', initials, color: 'av-violet', plan: data.get('plan'), status: 'Active', billing, amount });
  renderSubscriptions();
  dialog.close();
  showToast(`Subscription created for ${customer}.`);
});

document.querySelector('#filter-button').addEventListener('click', () => {
  const options = ['All statuses', 'Active', 'Trial', 'Past due'];
  const current = options.indexOf(statusFilter);
  statusFilter = options[(current + 1) % options.length];
  document.querySelector('#filter-button').innerHTML = `☷ <span>${statusFilter === 'All statuses' ? 'Filter' : statusFilter}</span>`;
  renderSubscriptions();
  if (statusFilter !== 'All statuses') showToast(`Showing ${statusFilter.toLowerCase()} subscriptions.`);
});

document.querySelector('#export-button').addEventListener('click', () => {
  const fields = ['id', 'customer', 'email', 'plan', 'status', 'billing', 'amount'];
  const csv = [fields.join(','), ...subscriptions.map((item) => fields.map((key) => `"${String(item[key]).replaceAll('"', '""')}"`).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'brightloop-subscriptions.csv';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Subscription list exported.');
});

document.querySelectorAll('.nav-item[data-page]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  const page = button.dataset.page;
  document.querySelector('#breadcrumb-page').textContent = page;
  document.querySelector('#page-title').innerHTML = page === 'Overview' ? 'Good morning, Alex <span class="wave">✳</span>' : page;
  document.querySelector('.welcome-subtitle').textContent = page === 'Overview' ? 'Here’s what’s happening with your subscriptions today.' : `${page} workspace · Your Brightloop ${page.toLowerCase()} at a glance.`;
  if (page !== 'Overview') showToast(`${page} section selected.`);
}));
document.querySelectorAll('[data-goto]').forEach((button) => button.addEventListener('click', () => document.querySelector(`.nav-item[data-page="${button.dataset.goto}"]`).click()));
document.querySelector('#range-button').addEventListener('click', () => showToast('Date range: Last 30 days'));
document.querySelector('#revenue-period').addEventListener('click', () => showToast('Revenue is shown by month.'));
document.querySelector('.search-trigger').addEventListener('click', () => { searchInput.focus(); searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
document.querySelector('.bell').addEventListener('click', () => showToast('You’re all caught up.'));
renderSubscriptions();
