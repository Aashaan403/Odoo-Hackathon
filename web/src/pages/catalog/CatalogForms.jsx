import { useState } from 'react';
import { useApiMutation } from '../../lib/api.js';
import { isoToday } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { Drawer } from '../../components/Drawer.jsx';
import { Field, FormGrid, Input, Select, Textarea, Toggle } from '../../components/Field.jsx';
import { Section } from '../../components/Layout.jsx';

// Shared drawer frame: POST to create, PATCH to edit, toast with the record's name.
function EntityDrawer({ kind, label, record, form, toBody, onClose, children }) {
  const save = useApiMutation({ onSuccess: onClose });
  const editing = Boolean(record?.id);
  const submit = (event) => {
    event.preventDefault();
    save.mutate({ path: `/${kind}${editing ? `/${record.id}` : ''}`, method: editing ? 'PATCH' : 'POST', body: toBody(form), success: `${form.name} ${editing ? 'updated' : 'created'}.` });
  };
  return (
    <Drawer open onClose={onClose} kicker="Catalog" title={editing ? `Edit ${record.name}` : `New ${label}`}
      footer={<><Button type="submit" form="catalog-form" busy={save.isPending}>{editing ? 'Save changes' : `Create ${label}`}</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></>}>
      <form id="catalog-form" onSubmit={submit} className="flex flex-col gap-10">{children}</form>
    </Drawer>
  );
}

const useForm = (initial) => {
  const [form, setForm] = useState(initial);
  return [form, (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })), setForm];
};

export function ProductForm({ record, onClose }) {
  const [form, bind, setForm] = useForm({ name: '', type: 'service', salesPrice: '', costPrice: '', notes: '', variants: [], active: true, ...record });
  const setVariant = (index, key, value) => setForm((current) => ({ ...current, variants: current.variants.map((variant, position) => (position === index ? { ...variant, [key]: value } : variant)) }));
  return (
    <EntityDrawer kind="products" label="product" record={record} form={form} onClose={onClose}
      toBody={(values) => ({ ...values, salesPrice: Number(values.salesPrice), costPrice: Number(values.costPrice), variants: values.variants.filter((variant) => variant.name.trim()).map((variant) => ({ name: variant.name.trim(), priceDelta: Number(variant.priceDelta) || 0 })) })}>
      <Section title="Product">
        <FormGrid>
          <Field label="Name" className="sm:col-span-2"><Input value={form.name} onChange={bind('name')} required /></Field>
          <Field label="Type"><Select value={form.type} onChange={bind('type')}><option value="service">Service</option><option value="subscription">Subscription</option><option value="goods">Goods</option></Select></Field>
          <div />
          <Field label="Sales price" hint="Default price per unit"><Input type="number" min="0" step="0.01" value={form.salesPrice} onChange={bind('salesPrice')} required /></Field>
          <Field label="Cost price" hint="Used to show margin"><Input type="number" min="0" step="0.01" value={form.costPrice} onChange={bind('costPrice')} required /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={bind('notes')} maxLength={1000} /></Field>
        </FormGrid>
        {record?.id && <Toggle className="mt-3" label="Available for new subscriptions" checked={form.active} onChange={bind('active')} />}
      </Section>
      <Section title="Variants" action={<Button variant="quiet" size="sm" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, { name: '', priceDelta: 0 }] }))}>Add variant</Button>}>
        <p className="mb-3 text-body text-mute">A variant changes the unit price, for example the Odoo brand adds 560.</p>
        <div className="flex flex-col gap-3">
          {form.variants.map((variant, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_9rem_auto] items-end gap-3">
              <Field label="Variant name"><Input value={variant.name} onChange={(event) => setVariant(index, 'name', event.target.value)} /></Field>
              <Field label="Price change"><Input type="number" step="0.01" value={variant.priceDelta} onChange={(event) => setVariant(index, 'priceDelta', event.target.value)} /></Field>
              <Button variant="quiet" className="mb-2.5" onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((_, position) => position !== index) }))}>Remove</Button>
            </div>
          ))}
          {!form.variants.length && <p className="text-body text-faint">No variants. Every unit is sold at the sales price.</p>}
        </div>
      </Section>
    </EntityDrawer>
  );
}

export function PlanForm({ record, products, onClose }) {
  const [form, bind] = useForm({ name: '', productId: products[0]?.id || '', price: '', interval: 'monthly', minQuantity: 1, availableFrom: isoToday(), availableTo: '', autoClose: false, allowEarlyClose: true, allowPause: true, allowRenew: true, active: true, ...record });
  return (
    <EntityDrawer kind="plans" label="plan" record={record} form={form} onClose={onClose}
      toBody={(values) => ({ ...values, price: Number(values.price), minQuantity: Number(values.minQuantity) })}>
      <Section title="Pricing">
        <FormGrid>
          <Field label="Plan name" className="sm:col-span-2"><Input value={form.name} onChange={bind('name')} required /></Field>
          <Field label="Product"><Select value={form.productId} onChange={bind('productId')}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</Select></Field>
          <Field label="Bills every"><Select value={form.interval} onChange={bind('interval')}><option value="daily">Day</option><option value="weekly">Week</option><option value="monthly">Month</option><option value="yearly">Year</option></Select></Field>
          <Field label="Price per unit per period"><Input type="number" min="0" step="0.01" value={form.price} onChange={bind('price')} required /></Field>
          <Field label="Minimum quantity"><Input type="number" min="1" value={form.minQuantity} onChange={bind('minQuantity')} required /></Field>
        </FormGrid>
      </Section>
      <Section title="Availability">
        <FormGrid>
          <Field label="Available from"><Input type="date" value={form.availableFrom} onChange={bind('availableFrom')} required /></Field>
          <Field label="Available until" hint="Leave empty to keep it on sale"><Input type="date" value={form.availableTo} onChange={bind('availableTo')} /></Field>
        </FormGrid>
      </Section>
      <Section title="What subscribers can do">
        <div className="border-t border-line">
          <Toggle label="Close automatically at expiry" description="Subscriptions end on their expiry date without anyone acting" checked={form.autoClose} onChange={bind('autoClose')} />
          <Toggle label="Can be closed early" checked={form.allowEarlyClose} onChange={bind('allowEarlyClose')} />
          <Toggle label="Can be paused" description="No invoices are created while paused" checked={form.allowPause} onChange={bind('allowPause')} />
          <Toggle label="Can be renewed" checked={form.allowRenew} onChange={bind('allowRenew')} />
          {record?.id && <Toggle label="On sale" description="Turn off to stop new subscriptions to this plan" checked={form.active} onChange={bind('active')} />}
        </div>
      </Section>
    </EntityDrawer>
  );
}

export function TaxForm({ record, onClose }) {
  const [form, bind] = useForm({ name: '', rate: '', active: true, ...record });
  return (
    <EntityDrawer kind="taxes" label="tax rule" record={record} form={form} onClose={onClose} toBody={(values) => ({ name: values.name, rate: Number(values.rate), active: values.active })}>
      <Section title="Tax rule">
        <FormGrid>
          <Field label="Name"><Input value={form.name} onChange={bind('name')} required /></Field>
          <Field label="Rate (%)"><Input type="number" min="0" max="100" step="0.01" value={form.rate} onChange={bind('rate')} required /></Field>
        </FormGrid>
        <Toggle className="mt-3" label="Apply to invoices" description="Active taxes are added to every new invoice line that uses them" checked={form.active} onChange={bind('active')} />
      </Section>
    </EntityDrawer>
  );
}

export function DiscountForm({ record, products, onClose }) {
  const [form, bind, setForm] = useForm({ name: '', type: 'percentage', value: '', scope: 'subscriptions', productIds: [], minimumPurchase: 0, minimumQuantity: 1, startDate: isoToday(), endDate: '', maxUses: 0, active: true, ...record });
  const toggleProduct = (id) => setForm((current) => ({ ...current, productIds: current.productIds.includes(id) ? current.productIds.filter((value) => value !== id) : [...current.productIds, id] }));
  return (
    <EntityDrawer kind="discounts" label="discount" record={record} form={form} onClose={onClose}
      toBody={(values) => ({ ...values, value: Number(values.value), minimumPurchase: Number(values.minimumPurchase), minimumQuantity: Number(values.minimumQuantity), maxUses: Number(values.maxUses), productIds: values.scope === 'products' ? values.productIds : [] })}>
      <Section title="Discount">
        <FormGrid>
          <Field label="Name" className="sm:col-span-2"><Input value={form.name} onChange={bind('name')} required /></Field>
          <Field label="Type"><Select value={form.type} onChange={bind('type')}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></Select></Field>
          <Field label={form.type === 'percentage' ? 'Percent off' : 'Amount off'}><Input type="number" min="0" max={form.type === 'percentage' ? 100 : undefined} step="0.01" value={form.value} onChange={bind('value')} required /></Field>
          <Field label="Applies to" className="sm:col-span-2"><Select value={form.scope} onChange={bind('scope')}><option value="subscriptions">The whole subscription</option><option value="products">Specific products</option></Select></Field>
        </FormGrid>
        {form.scope === 'products' && (
          <div className="mt-3 border-t border-line">
            {products.map((product) => <Toggle key={product.id} label={product.name} checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />)}
          </div>
        )}
      </Section>
      <Section title="Conditions">
        <FormGrid>
          <Field label="Minimum purchase" hint="Subtotal before the discount"><Input type="number" min="0" step="0.01" value={form.minimumPurchase} onChange={bind('minimumPurchase')} /></Field>
          <Field label="Minimum quantity" hint="Total units on the subscription"><Input type="number" min="1" value={form.minimumQuantity} onChange={bind('minimumQuantity')} /></Field>
          <Field label="Starts"><Input type="date" value={form.startDate} onChange={bind('startDate')} required /></Field>
          <Field label="Ends" hint="Leave empty for no end date"><Input type="date" value={form.endDate} onChange={bind('endDate')} /></Field>
          <Field label="Usage limit" hint="Invoices it can apply to. 0 means unlimited"><Input type="number" min="0" value={form.maxUses} onChange={bind('maxUses')} /></Field>
        </FormGrid>
        {record?.id && <Toggle className="mt-3" label="Active" description="Turn off to stop applying it to new invoices" checked={form.active} onChange={bind('active')} />}
      </Section>
    </EntityDrawer>
  );
}
