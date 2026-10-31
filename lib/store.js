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

function seedDatabase() {
  const customerIds = ['cus_northstar', 'cus_studio', 'cus_acme'];
  const planIds = ['plan_starter', 'plan_business', 'plan_enterprise'];
  return {
    users: [
      { id: 'usr_admin', name: 'Alex Morgan', email: 'admin@brightloop.io', role: 'admin', customerId: null, passwordHash: '', createdAt: new Date().toISOString() },
      { id: 'usr_staff', name: 'Jamie Lee', email: 'staff@brightloop.io', role: 'staff', customerId: null, passwordHash: '', createdAt: new Date().toISOString() },
      { id: 'usr_customer', name: 'Olivia Rhye', email: 'olivia@northstar.io', role: 'customer', customerId: customerIds[0], passwordHash: '', createdAt: new Date().toISOString() },
    ],
    customers: [
      { id: customerIds[0], name: 'Olivia Rhye', company: 'Northstar Studio', email: 'olivia@northstar.io', phone: '+1 415 555 0182', createdAt: new Date().toISOString() },
      { id: customerIds[1], name: 'Phoenix Baker', company: 'Baker & Co.', email: 'phoenix@baker.co', phone: '+1 212 555 0114', createdAt: new Date().toISOString() },
      { id: customerIds[2], name: 'Lana Steiner', company: 'Acme Analytics', email: 'lana@acme.io', phone: '+1 646 555 0126', createdAt: new Date().toISOString() },
    ],
    products: [
      { id: 'prd_workspace', name: 'Brightloop Workspace', type: 'service', salesPrice: 49, costPrice: 12, notes: 'Collaborative workspace subscription', variants: [{ name: 'Odoo', priceDelta: 560 }, { name: 'Standard', priceDelta: 0 }], active: true },
      { id: 'prd_automation', name: 'Workflow Automation', type: 'service', salesPrice: 100, costPrice: 24, notes: 'Automate repetitive workflows', variants: [{ name: 'Standard', priceDelta: 0 }], active: true },
      { id: 'prd_support', name: 'Priority Support', type: 'service', salesPrice: 75, costPrice: 18, notes: 'Priority response support add-on', variants: [], active: true },
    ],
    plans: [
      { id: planIds[0], name: 'Starter', productId: 'prd_workspace', price: 49, interval: 'monthly', minQuantity: 1, availableFrom: day(-365), availableTo: '', autoClose: false, allowEarlyClose: true, allowPause: true, allowRenew: true, active: true },
      { id: planIds[1], name: 'Business', productId: 'prd_workspace', price: 149, interval: 'monthly', minQuantity: 3, availableFrom: day(-365), availableTo: '', autoClose: false, allowEarlyClose: true, allowPause: true, allowRenew: true, active: true },
      { id: planIds[2], name: 'Enterprise', productId: 'prd_automation', price: 399, interval: 'yearly', minQuantity: 10, availableFrom: day(-365), availableTo: '', autoClose: true, allowEarlyClose: false, allowPause: false, allowRenew: true, active: true },
    ],
    taxes: [{ id: 'tax_us', name: 'US Sales Tax', rate: 8.25, active: true }],
    discounts: [
      { id: 'dsc_welcome', name: 'Welcome 10%', type: 'percentage', value: 10, minimumPurchase: 0, minimumQuantity: 1, startDate: day(-365), endDate: '', maxUses: 100, usedCount: 0, scope: 'subscriptions', productIds: [], active: true },
    ],
    quoteTemplates: [
      { id: 'qte_business', name: 'Business plan proposal', validityDays: 30, planId: planIds[1], lines: [{ productId: 'prd_workspace', quantity: 3, unitPrice: 149, taxIds: ['tax_us'] }] },
      { id: 'qte_enterprise', name: 'Enterprise annual proposal', validityDays: 45, planId: planIds[2], lines: [{ productId: 'prd_automation', quantity: 10, unitPrice: 399, taxIds: ['tax_us'] }] },
    ],
    subscriptions: [
      { id: 'sub_0248', number: 'SUB-0248', customerId: customerIds[0], planId: planIds[1], status: 'Active', startDate: day(-45), expiryDate: '', nextBillingDate: day(12), paymentTermsDays: 15, discountId: 'dsc_welcome', lines: [{ productId: 'prd_workspace', description: 'Brightloop Workspace', quantity: 3, unitPrice: 49, variant: 'Standard', taxIds: ['tax_us'] }] },
      { id: 'sub_0247', number: 'SUB-0247', customerId: customerIds[1], planId: planIds[0], status: 'Trial', startDate: day(-5), expiryDate: day(9), nextBillingDate: day(9), paymentTermsDays: 15, discountId: '', lines: [{ productId: 'prd_workspace', description: 'Brightloop Workspace', quantity: 1, unitPrice: 49, variant: 'Standard', taxIds: ['tax_us'] }] },
      { id: 'sub_0246', number: 'SUB-0246', customerId: customerIds[2], planId: planIds[2], status: 'Active', startDate: day(-95), expiryDate: day(270), nextBillingDate: day(4), paymentTermsDays: 30, discountId: '', lines: [{ productId: 'prd_automation', description: 'Workflow Automation', quantity: 10, unitPrice: 399, variant: '', taxIds: ['tax_us'] }] },
    ],
    invoices: [
      { id: 'inv_0101', number: 'INV-0101', customerId: customerIds[0], subscriptionId: 'sub_0248', billingPeriod: day(-18).slice(0, 7), issueDate: day(-18), dueDate: day(-3), lines: [{ productId: 'prd_workspace', description: 'Brightloop Workspace', quantity: 3, unitPrice: 49, taxRate: 8.25, amount: 147, taxAmount: 12.13 }], subtotal: 147, discountAmount: 14.7, taxAmount: 10.92, total: 143.22, status: 'Paid', sentAt: day(-18), cancelled: false },
      { id: 'inv_0102', number: 'INV-0102', customerId: customerIds[1], subscriptionId: 'sub_0247', billingPeriod: day(-12).slice(0, 7), issueDate: day(-12), dueDate: day(-1), lines: [{ productId: 'prd_workspace', description: 'Brightloop Workspace', quantity: 1, unitPrice: 49, taxRate: 8.25, amount: 49, taxAmount: 4.04 }], subtotal: 49, discountAmount: 0, taxAmount: 4.04, total: 53.04, status: 'Confirmed', sentAt: day(-12), cancelled: false },
    ],
    payments: [{ id: 'pay_0101', invoiceId: 'inv_0101', method: 'card', amount: 143.22, date: day(-17), note: 'Automatic card payment' }],
    emailOutbox: [],
    passwordResets: [],
    counters: { subscription: 248, invoice: 102 },
    metadata: { createdAt: new Date().toISOString(), seedDate: today },
  };
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

module.exports = { uid, seedDatabase, readDatabase, writeDatabase };
