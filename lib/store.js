const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dataDirectory = path.join(__dirname, '..', 'data');
const databasePath = path.join(dataDirectory, 'brightloop.json');
const today = new Date().toISOString().slice(0, 10);
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

// Deterministic generator so every fresh demo workspace looks the same.
function seededRandom(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_CUSTOMERS = [
  ['Olivia Rhye', 'Northstar Studio', 'olivia@northstar.io'], ['Phoenix Baker', 'Baker & Co.', 'phoenix@baker.co'], ['Lana Steiner', 'Acme Analytics', 'lana@acme.io'],
  ['Demi Wilkinson', 'Kestrel Logistics'], ['Candice Wu', 'Orchid Dental'], ['Natali Craig', 'Tidewater Books'], ['Drew Cano', 'Quarry Coffee'], ['Orlando Diggs', 'Fieldnote Media'],
  ['Andi Lane', 'Palisade Legal'], ['Kate Morrison', 'Juniper Health'], ['Koray Okumus', 'Copperline Retail'], ['Ava Wright', 'Meridian Architects'], ['Eve Leroy', 'Saltbox Bakery'],
  ['Zahir Mays', 'Granite Peak Fitness'], ['Joshua Wilson', 'Lantern Learning'], ['Rene Wells', 'Bluebird Florals'], ['Amelie Laurent', 'Atlas Freight'], ['Sophia Perez', 'Pinecrest Realty'],
  ['Mollie Hall', 'Mosaic Interiors'], ['Lyle Kauffman', 'Riverside Vets'], ['Priya Nair', 'Summit Payroll'], ['Kenji Sato', 'Cobalt Robotics'], ['Marta Kowalski', 'Hearth & Home'],
  ['Isabel Cruz', 'Wildflower Yoga'], ['Tomás Rivera', 'Ironwood Builders'], ['Hana Kim', 'Sable Studio'], ['Felix Braun', 'Driftwood Hotels'], ['Arjun Mehta', 'Verve Cycles'],
  ['Grace Okafor', 'Oakmont Clinic'], ['Liam Byrne', 'Nimbus Travel'], ['Nora Lindqvist', 'Paperkite Press'], ['Omar Haddad', 'Foxglove Gardens'], ['Chloe Martin', 'Beacon Insurance'],
  ['Mateo Silva', 'Trailhead Outfitters'], ['Ruth Adeyemi', 'Larkspur Events'], ['Ishaan Rao', 'Quill & Ink'],
];

function seedCustomers() {
  return DEMO_CUSTOMERS.map(([name, company, email], index) => {
    const slug = company.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '');
    return { id: index < 3 ? ['cus_northstar', 'cus_studio', 'cus_acme'][index] : `cus_${slug}`, name, company, email: email || `${name.split(' ')[0].toLowerCase()}@${slug}.com`, phone: `+1 ${415 + (index % 5) * 101} 555 0${String(100 + index * 7).slice(-3)}`, createdAt: new Date(Date.now() - (400 - index * 9) * 86400000).toISOString() };
  });
}

function seedSubscriptions(customers, plans) {
  const random = seededRandom(20261031);
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = (weights) => { let roll = random(); for (const [value, weight] of weights) { roll -= weight; if (roll <= 0) return value; } return weights[0][0]; };
  const planById = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
  const subscriptions = [];
  const addSubscription = (customerId, planId, status, startOffset, options = {}) => {
    const plan = planById[planId];
    const startDate = day(startOffset);
    const quantity = options.quantity || plan.minQuantity + between(0, plan.minQuantity >= 3 ? 7 : 2);
    const odoo = plan.productId === 'prd_workspace' && random() < 0.15;
    const lines = [{ productId: plan.productId, description: plan.productId === 'prd_workspace' ? 'Brightloop Workspace' : plan.productId === 'prd_support' ? 'Priority Support' : 'Workflow Automation', quantity, unitPrice: plan.price + (odoo ? 560 : 0), variant: odoo ? 'Odoo' : (plan.productId === 'prd_workspace' ? 'Standard' : ''), taxIds: ['tax_us'] }];
    if (options.addOn ?? (planId !== 'plan_support' && random() < 0.22)) lines.push({ productId: 'prd_support', description: 'Priority Support', quantity: 1, unitPrice: 75, variant: '', taxIds: ['tax_us'] });
    const number = 101 + subscriptions.length;
    subscriptions.push({
      id: `sub_${String(number).padStart(4, '0')}`, number: `SUB-${String(number).padStart(4, '0')}`, customerId, planId, status, startDate,
      expiryDate: options.expiryDate || '', nextBillingDate: startDate, billingDay: Number(startDate.slice(-2)), paymentTermsDays: options.terms || pick([[7, 0.2], [15, 0.5], [30, 0.3]]),
      discountId: options.discountId ?? (quantity >= 10 && plan.productId === 'prd_workspace' ? 'dsc_volume' : random() < 0.12 ? 'dsc_welcome' : ''), lines, quoteTemplateId: options.quoteTemplateId || '',
    });
  };

  addSubscription('cus_northstar', 'plan_business', 'Active', -214, { quantity: 4, discountId: 'dsc_welcome', addOn: false, terms: 15 });
  addSubscription('cus_northstar', 'plan_support', 'Active', -96, { quantity: 1, addOn: false, discountId: '', terms: 15 });
  addSubscription('cus_studio', 'plan_starter', 'Active', -48, { quantity: 1, addOn: false, discountId: '', terms: 7 });
  addSubscription('cus_acme', 'plan_enterprise', 'Active', -95, { quantity: 12, addOn: true, discountId: '', terms: 30, expiryDate: day(270) });

  for (let index = 0; index < 88; index += 1) {
    const customerId = customers[3 + (index % (customers.length - 3))].id;
    const planId = pick([['plan_starter', 0.34], ['plan_business', 0.34], ['plan_enterprise', 0.12], ['plan_support', 0.1], ['plan_sprint', 0.1]]);
    const status = pick([['Active', 0.8], ['Paused', 0.05], ['Closed', 0.03], ['Draft', 0.04], ['Quotation', 0.04], ['Confirmed', 0.04]]);
    // Skew start dates toward recent months so recurring revenue grows across the year.
    const age = Math.floor((planId === 'plan_sprint' ? 56 : 380) * Math.pow(random(), 1.35)) + 3;
    if (status === 'Active') addSubscription(customerId, planId, status, -age, planId === 'plan_enterprise' && random() < 0.3 ? { expiryDate: day(-between(5, 40)) } : {});
    else if (status === 'Paused' || status === 'Closed') addSubscription(customerId, planId === 'plan_sprint' ? 'plan_starter' : planId, status, -age);
    else addSubscription(customerId, planId === 'plan_sprint' ? 'plan_business' : planId, status, between(2, 14), status === 'Quotation' ? { expiryDate: day(between(10, 30)), quoteTemplateId: planId === 'plan_enterprise' ? 'qte_enterprise' : 'qte_business' } : {});
  }
  return subscriptions;
}

function seedDatabase() {
  const customers = seedCustomers();
  const plans = [
    { id: 'plan_starter', name: 'Starter', productId: 'prd_workspace', price: 49, interval: 'monthly', minQuantity: 1, availableFrom: day(-420), availableTo: '', autoClose: false, allowEarlyClose: true, allowPause: true, allowRenew: true, active: true },
    { id: 'plan_business', name: 'Business', productId: 'prd_workspace', price: 149, interval: 'monthly', minQuantity: 3, availableFrom: day(-420), availableTo: '', autoClose: false, allowEarlyClose: true, allowPause: true, allowRenew: true, active: true },
    { id: 'plan_enterprise', name: 'Enterprise', productId: 'prd_automation', price: 399, interval: 'yearly', minQuantity: 10, availableFrom: day(-420), availableTo: '', autoClose: true, allowEarlyClose: false, allowPause: false, allowRenew: true, active: true },
    { id: 'plan_support', name: 'Priority Support', productId: 'prd_support', price: 75, interval: 'monthly', minQuantity: 1, availableFrom: day(-420), availableTo: '', autoClose: false, allowEarlyClose: true, allowPause: true, allowRenew: true, active: true },
    { id: 'plan_sprint', name: 'Automation Sprint', productId: 'prd_automation', price: 39, interval: 'weekly', minQuantity: 1, availableFrom: day(-60), availableTo: day(45), autoClose: true, allowEarlyClose: true, allowPause: false, allowRenew: false, active: true },
  ];
  return {
    users: [
      { id: 'usr_admin', name: 'Alex Morgan', email: 'admin@brightloop.io', role: 'admin', customerId: null, passwordHash: '', createdAt: new Date().toISOString() },
      { id: 'usr_staff', name: 'Jamie Lee', email: 'staff@brightloop.io', role: 'staff', customerId: null, passwordHash: '', createdAt: new Date().toISOString() },
      { id: 'usr_customer', name: 'Olivia Rhye', email: 'olivia@northstar.io', role: 'customer', customerId: 'cus_northstar', passwordHash: '', createdAt: new Date().toISOString() },
    ],
    customers,
    products: [
      { id: 'prd_workspace', name: 'Brightloop Workspace', type: 'service', salesPrice: 49, costPrice: 12, notes: 'Collaborative workspace, billed per seat', variants: [{ name: 'Standard', priceDelta: 0 }, { name: 'Odoo', priceDelta: 560 }], active: true },
      { id: 'prd_automation', name: 'Workflow Automation', type: 'service', salesPrice: 100, costPrice: 24, notes: 'Automate repetitive back-office workflows', variants: [{ name: 'Standard', priceDelta: 0 }], active: true },
      { id: 'prd_support', name: 'Priority Support', type: 'service', salesPrice: 75, costPrice: 18, notes: 'Four-hour response add-on', variants: [], active: true },
    ],
    plans,
    taxes: [{ id: 'tax_us', name: 'US Sales Tax', rate: 8.25, active: true }, { id: 'tax_eu', name: 'EU VAT', rate: 20, active: false }],
    discounts: [
      { id: 'dsc_welcome', name: 'Welcome 10%', type: 'percentage', value: 10, minimumPurchase: 0, minimumQuantity: 1, startDate: day(-420), endDate: '', maxUses: 250, usedCount: 0, scope: 'subscriptions', productIds: [], active: true },
      { id: 'dsc_volume', name: 'Volume seats 15%', type: 'percentage', value: 15, minimumPurchase: 0, minimumQuantity: 10, startDate: day(-420), endDate: '', maxUses: 0, usedCount: 0, scope: 'products', productIds: ['prd_workspace'], active: true },
      { id: 'dsc_launch', name: 'Launch credit $50', type: 'fixed', value: 50, minimumPurchase: 200, minimumQuantity: 1, startDate: day(-150), endDate: day(-30), maxUses: 40, usedCount: 0, scope: 'subscriptions', productIds: [], active: true },
    ],
    quoteTemplates: [
      { id: 'qte_business', name: 'Business plan proposal', validityDays: 30, planId: 'plan_business', lines: [{ productId: 'prd_workspace', quantity: 5, unitPrice: 149, taxIds: ['tax_us'] }] },
      { id: 'qte_enterprise', name: 'Enterprise annual proposal', validityDays: 45, planId: 'plan_enterprise', lines: [{ productId: 'prd_automation', quantity: 10, unitPrice: 399, taxIds: ['tax_us'] }] },
      { id: 'qte_starter_support', name: 'Starter with priority support', validityDays: 14, planId: 'plan_starter', lines: [{ productId: 'prd_workspace', quantity: 2, unitPrice: 49, taxIds: ['tax_us'] }, { productId: 'prd_support', quantity: 1, unitPrice: 75, taxIds: ['tax_us'] }] },
    ],
    subscriptions: seedSubscriptions(customers, plans),
    invoices: [],
    payments: [],
    emailOutbox: [],
    passwordResets: [],
    counters: { subscription: 192, invoice: 1000 },
    metadata: { createdAt: new Date().toISOString(), seedDate: today, demoSettled: false },
  };
}

// After the first billing run creates a year of invoices, mark history as sent and paid
// so reports have realistic collections, with a few late and partial payers.
function settleDemoInvoices(db, currentDay) {
  if (!db.metadata || db.metadata.demoSettled !== false) return false;
  const methods = ['card', 'bank transfer', 'direct debit', 'card', 'cash'];
  const notes = { card: 'Card on file', 'bank transfer': 'Bank transfer received', 'direct debit': 'Direct debit collection', cash: 'Paid at office' };
  const ordered = db.invoices.slice().sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  const northstarLatestDue = ordered.filter((invoice) => invoice.customerId === 'cus_northstar' && invoice.dueDate < currentDay).at(-1);
  ordered.forEach((invoice, index) => {
    const age = (Date.parse(currentDay) - Date.parse(invoice.issueDate)) / 86400000;
    if (age < 3) return;
    invoice.status = 'Confirmed';
    invoice.sentAt = `${invoice.issueDate}T09:00:00.000Z`;
    const daysLate = (Date.parse(currentDay) - Date.parse(invoice.dueDate)) / 86400000;
    const unpaid = invoice === northstarLatestDue || (daysLate > 0 ? daysLate <= 45 && index % 4 === 1 : index % 5 < 2);
    if (unpaid) return;
    const method = methods[index % methods.length];
    const partial = index % 9 === 7 && daysLate > 0 && daysLate <= 45;
    const amount = partial ? Number((invoice.total / 2).toFixed(2)) : invoice.total;
    const paidOn = new Date(Math.min(Date.parse(currentDay), Date.parse(invoice.issueDate) + ((index * 7) % 18) * 86400000)).toISOString().slice(0, 10);
    db.payments.push({ id: `pay_${invoice.number.slice(4).toLowerCase()}`, invoiceId: invoice.id, method, amount, date: paidOn, note: partial ? 'Partial payment, balance promised' : notes[method] });
    if (!partial) invoice.status = 'Paid';
  });
  db.payments.sort((a, b) => b.date.localeCompare(a.date));
  db.metadata.demoSettled = true;
  return true;
}

function readDatabase() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  if (!fs.existsSync(databasePath)) {
    const db = seedDatabase();
    writeDatabase(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(databasePath, 'utf8'));
}

function writeDatabase(db) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporaryPath = `${databasePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(db, null, 2));
  fs.renameSync(temporaryPath, databasePath);
}

module.exports = { uid, seedDatabase, settleDemoInvoices, readDatabase, writeDatabase };
