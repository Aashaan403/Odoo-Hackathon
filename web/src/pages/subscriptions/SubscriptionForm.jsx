import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, useApiMutation } from '../../lib/api.js';
import { intervalLabel, isoToday, money } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { Drawer } from '../../components/Drawer.jsx';
import { Field, FormGrid, Input, Select, Toggle } from '../../components/Field.jsx';
import { Section, Totals } from '../../components/Layout.jsx';

const isAvailable = (plan, today) => plan.active && plan.availableFrom <= today && (!plan.availableTo || plan.availableTo >= today);

export function SubscriptionForm({ data, lookups, initialPlanId, initialTemplateId, onClose, onCreated }) {
  const today = isoToday();
  const staff = data.user.role !== 'customer';
  const plans = data.plans.filter((plan) => isAvailable(plan, today));
  const templates = (data.quoteTemplates || []).filter((template) => plans.some((plan) => plan.id === template.planId));
  const [form, setForm] = useState(() => {
    const template = templates.find((item) => item.id === initialTemplateId);
    const plan = plans.find((item) => item.id === (template?.planId || initialPlanId)) || plans[0];
    return { customerId: data.customers?.[0]?.id || '', templateId: template?.id || '', planId: plan?.id || '', variant: '', quantity: plan?.minQuantity || 1, addOns: [], startDate: today, expiryDate: '', paymentTermsDays: 15, discountId: '' };
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const plan = lookups.plans.get(form.planId);
  const product = plan && lookups.products.get(plan.productId);
  const template = templates.find((item) => item.id === form.templateId);
  const activeTaxIds = data.taxes.filter((tax) => tax.active).map((tax) => tax.id);
  const variant = product?.variants?.find((item) => item.name === form.variant);

  const lines = useMemo(() => {
    if (template || !plan) return undefined;
    const primary = { productId: plan.productId, description: product?.name, quantity: Number(form.quantity), unitPrice: Number(plan.price) + Number(variant?.priceDelta || 0), variant: form.variant, taxIds: activeTaxIds };
    const extras = form.addOns.map((productId) => { const addOn = lookups.products.get(productId); return { productId, description: addOn.name, quantity: 1, unitPrice: addOn.salesPrice, taxIds: activeTaxIds }; });
    return [primary, ...extras];
  }, [template, plan, product, form.quantity, form.variant, form.addOns, variant, activeTaxIds.join(), lookups]);

  const pricingBody = { planId: form.planId, templateId: form.templateId || undefined, lines, discountId: staff ? form.discountId : '' };
  const preview = useQuery({ queryKey: ['preview-form', pricingBody], queryFn: () => api('/subscriptions/preview', { method: 'POST', body: pricingBody }), enabled: Boolean(form.planId), placeholderData: keepPreviousData, retry: false });
  const create = useApiMutation({ onSuccess: (subscription) => onCreated(subscription) });

  function submit(event) {
    event.preventDefault();
    const body = { ...pricingBody, customerId: staff ? form.customerId : undefined, startDate: form.startDate, expiryDate: form.expiryDate || undefined, paymentTermsDays: Number(form.paymentTermsDays) };
    create.mutate({ path: '/subscriptions', body, success: (subscription) => (subscription.status === 'Quotation' ? `Quotation ${subscription.number} created.` : staff ? `${subscription.number} saved as a draft.` : `You are subscribed. ${subscription.number} is active.`) });
  }

  const addOnChoices = data.products.filter((item) => item.active && item.id !== plan?.productId);
  const priced = preview.data;

  return (
    <Drawer open onClose={onClose} kicker={staff ? 'Create a record' : 'Subscribe'} title={template ? 'New quotation' : staff ? 'New subscription' : `Subscribe to ${plan?.name || 'a plan'}`} wide
      footer={<><Button type="submit" form="subscription-form" busy={create.isPending} disabled={!form.planId || (staff && !form.customerId)}>{template ? 'Create quotation' : staff ? 'Save as draft' : 'Start subscription'}</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></>}>
      <form id="subscription-form" onSubmit={submit} className="flex flex-col gap-10">
        <Section title="Who and what">
          <FormGrid>
            {staff && (
              <Field label="Customer" className="sm:col-span-2">
                <Select value={form.customerId} onChange={(event) => set('customerId', event.target.value)} required>
                  {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company || customer.name} ({customer.email})</option>)}
                </Select>
              </Field>
            )}
            {staff && (
              <Field label="Start from a quotation template" hint={template ? `Valid for ${template.validityDays} days once created` : 'Optional. Templates fill in the plan and lines.'} className="sm:col-span-2">
                <Select value={form.templateId} onChange={(event) => { const next = templates.find((item) => item.id === event.target.value); setForm((current) => ({ ...current, templateId: event.target.value, planId: next?.planId || current.planId })); }}>
                  <option value="">No template</option>
                  {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Plan" className="sm:col-span-2">
              <Select value={form.planId} disabled={Boolean(template)} onChange={(event) => { const next = lookups.plans.get(event.target.value); setForm((current) => ({ ...current, planId: event.target.value, variant: '', quantity: Math.max(Number(current.quantity), next?.minQuantity || 1) })); }}>
                {plans.map((item) => <option key={item.id} value={item.id}>{item.name}, {money(item.price)} per {intervalLabel[item.interval]}</option>)}
              </Select>
            </Field>
            {!template && (
              <>
                <Field label="Variant" hint={variant?.priceDelta ? `Adds ${money(variant.priceDelta)} to each unit` : undefined}>
                  <Select value={form.variant} onChange={(event) => set('variant', event.target.value)} disabled={!product?.variants?.length}>
                    <option value="">{product?.variants?.length ? 'Standard price' : 'No variants'}</option>
                    {product?.variants?.filter((item) => item.priceDelta).map((item) => <option key={item.name} value={item.name}>{item.name} (+{money(item.priceDelta)})</option>)}
                  </Select>
                </Field>
                <Field label="Quantity" hint={plan?.minQuantity > 1 ? `This plan needs at least ${plan.minQuantity}` : undefined}>
                  <Input type="number" min={plan?.minQuantity || 1} value={form.quantity} onChange={(event) => set('quantity', event.target.value)} required />
                </Field>
              </>
            )}
          </FormGrid>
          {!template && addOnChoices.length > 0 && (
            <div className="mt-4 border-t border-line pt-2">
              {addOnChoices.map((addOn) => (
                <Toggle key={addOn.id} label={`Add ${addOn.name}`} description={`${money(addOn.salesPrice)} per ${intervalLabel[plan?.interval] || 'period'}`} checked={form.addOns.includes(addOn.id)} onChange={(event) => set('addOns', event.target.checked ? [...form.addOns, addOn.id] : form.addOns.filter((id) => id !== addOn.id))} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Dates and terms">
          <FormGrid>
            <Field label="Start date"><Input type="date" value={form.startDate} min={staff ? undefined : today} onChange={(event) => set('startDate', event.target.value)} required /></Field>
            <Field label="Expiry date" hint={template ? 'Leave empty to use the template validity' : 'Leave empty to run until closed'}><Input type="date" value={form.expiryDate} onChange={(event) => set('expiryDate', event.target.value)} /></Field>
            {staff && <Field label="Payment terms" hint="Days after the invoice date"><Input type="number" min="0" value={form.paymentTermsDays} onChange={(event) => set('paymentTermsDays', event.target.value)} /></Field>}
            {staff && (
              <Field label="Discount" hint="Applied automatically to every invoice while valid">
                <Select value={form.discountId} onChange={(event) => set('discountId', event.target.value)}>
                  <option value="">No discount</option>
                  {data.discounts.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </Field>
            )}
          </FormGrid>
        </Section>

        <Section title="Price per period" action={preview.isFetching ? <span className="text-mute">Updating</span> : null}>
          {preview.error && <p className="text-body text-alarm">{preview.error.message}</p>}
          {priced && (
            <div className="border-t border-ink pt-3">
              {priced.lines.map((line, index) => (
                <div key={index} className="flex justify-between gap-6 py-1.5 text-body">
                  <span>{line.description}{line.variant ? `, ${line.variant}` : ''} <span className="text-mute">× {line.quantity}</span></span>
                  <span className="tabular-nums">{money(line.amount)}</span>
                </div>
              ))}
              <div className="mt-3 border-t border-line pt-3">
                <Totals rows={[
                  ['Subtotal', money(priced.subtotal)],
                  priced.discountAmount > 0 && ['Discount', `−${money(priced.discountAmount)}`],
                  ['Tax', money(priced.taxAmount)],
                  [`Total per ${intervalLabel[plan?.interval] || 'period'}`, money(priced.total), true],
                ]} />
              </div>
            </div>
          )}
        </Section>
      </form>
    </Drawer>
  );
}
