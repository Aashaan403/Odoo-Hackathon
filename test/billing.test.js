const test = require('node:test');
const assert = require('node:assert/strict');
const { addCycle, isStrongPassword, priceLines } = require('../lib/billing');

const taxes = [{ id: 'tax_gst', rate: 10, active: true }];
const line = (overrides = {}) => ({ productId: 'prd_a', description: 'Workspace', quantity: 2, unitPrice: 50, taxIds: ['tax_gst'], ...overrides });
const rule = (overrides = {}) => ({ id: 'dsc', active: true, type: 'percentage', value: 10, minimumPurchase: 0, minimumQuantity: 1, startDate: '2026-01-01', endDate: '', maxUses: 0, usedCount: 0, scope: 'subscriptions', productIds: [], ...overrides });

test('password policy needs length over 8, upper, lower and a special character', () => {
  assert.equal(isStrongPassword('Brightloop!2026'), true);
  assert.equal(isStrongPassword('Short!1a'), false);
  assert.equal(isStrongPassword('alllowercase!'), false);
  assert.equal(isStrongPassword('NoSpecialChar1'), false);
});

test('monthly cycles keep their anchor day through short months', () => {
  assert.equal(addCycle('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(addCycle('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(addCycle('2026-03-15', 'yearly'), '2027-03-15');
  assert.equal(addCycle('2026-03-15', 'weekly'), '2026-03-22');
});

test('tax is charged on the discounted amount', () => {
  const priced = priceLines({ lines: [line()], discount: rule(), taxes }, '2026-10-31');
  assert.equal(priced.subtotal, 100);
  assert.equal(priced.discountAmount, 10);
  assert.equal(priced.taxAmount, 9);
  assert.equal(priced.total, 99);
});

test('discounts stop when expired, used up or below their minimums', () => {
  const price = (discount) => priceLines({ lines: [line()], discount, taxes }, '2026-10-31').discountAmount;
  assert.equal(price(rule({ endDate: '2026-10-30' })), 0);
  assert.equal(price(rule({ maxUses: 5, usedCount: 5 })), 0);
  assert.equal(price(rule({ minimumQuantity: 3 })), 0);
  assert.equal(price(rule({ type: 'fixed', value: 500 })), 100);
});

test('product-scoped discounts only touch matching lines', () => {
  const lines = [line(), line({ productId: 'prd_b', unitPrice: 25 })];
  const priced = priceLines({ lines, discount: rule({ scope: 'products', productIds: ['prd_b'], value: 20 }), taxes }, '2026-10-31');
  assert.equal(priced.discountAmount, 10);
  assert.deepEqual(priced.lines.map((item) => item.discountAmount), [0, 10]);
});
