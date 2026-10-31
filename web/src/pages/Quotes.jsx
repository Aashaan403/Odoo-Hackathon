import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { lineTotal, useApiMutation, useLookups, useWorkspace } from '../lib/api.js';
import { formatDate, intervalLabel, money } from '../lib/format.js';
import { Button } from '../components/Button.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Drawer } from '../components/Drawer.jsx';
import { Field, FormGrid, Input, Select } from '../components/Field.jsx';
import { Loading, PageHeader, Section } from '../components/Layout.jsx';
import { StatusTag } from '../components/StatusTag.jsx';

function TemplateForm({ data, onClose }) {
  const plans = data.plans.filter((plan) => plan.active);
  const [form, setForm] = useState({ name: '', planId: plans[0]?.id || '', validityDays: 30, quantity: plans[0]?.minQuantity || 1 });
  const plan = plans.find((item) => item.id === form.planId);
  const create = useApiMutation({ onSuccess: onClose });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = (event) => {
    event.preventDefault();
    const taxIds = data.taxes.filter((tax) => tax.active).map((tax) => tax.id);
    create.mutate({ path: '/quote-templates', body: { name: form.name, planId: form.planId, validityDays: Number(form.validityDays), lines: [{ productId: plan.productId, quantity: Number(form.quantity), unitPrice: plan.price, taxIds }] }, success: `Template ${form.name} created.` });
  };
  return (
    <Drawer open onClose={onClose} kicker="Quotes" title="New template" footer={<><Button type="submit" form="template-form" busy={create.isPending}>Create template</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></>}>
      <form id="template-form" onSubmit={submit}>
        <FormGrid>
          <Field label="Template name" className="sm:col-span-2"><Input value={form.name} onChange={set('name')} placeholder="Business plan for ten seats" required /></Field>
          <Field label="Plan"><Select value={form.planId} onChange={(event) => { const next = plans.find((item) => item.id === event.target.value); setForm({ ...form, planId: event.target.value, quantity: Math.max(Number(form.quantity), next?.minQuantity || 1) }); }}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Quantity" hint={plan ? `${money(plan.price)} per unit, every ${intervalLabel[plan.interval]}` : undefined}><Input type="number" min={plan?.minQuantity || 1} value={form.quantity} onChange={set('quantity')} required /></Field>
          <Field label="Quote stays valid for" hint="Days after the quotation is created"><Input type="number" min="1" value={form.validityDays} onChange={set('validityDays')} required /></Field>
        </FormGrid>
      </form>
    </Drawer>
  );
}

export default function Quotes() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  if (isLoading || !lookups) return <Loading />;

  const admin = data.user.role === 'admin';
  const open = data.subscriptions.filter((item) => ['Draft', 'Quotation', 'Confirmed'].includes(item.status));
  const columns = [
    { key: 'number', header: 'Quote', render: (row) => <span className="font-semibold tabular-nums">{row.number}</span> },
    { key: 'customer', header: 'Customer', render: (row) => <span className="font-medium">{row.customer?.company || row.customer?.name}</span> },
    { key: 'plan', header: 'Plan', render: (row) => row.plan?.name },
    { key: 'status', header: 'Stage', render: (row) => <StatusTag status={row.status} /> },
    { key: 'valid', header: 'Valid until', render: (row) => <span className="tabular-nums">{row.expiryDate ? formatDate(row.expiryDate) : '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <><span className="block font-medium tabular-nums">{money(lineTotal(row.lines))}</span><span className="block text-caption text-mute">per {intervalLabel[row.plan?.interval]}</span></> },
  ];

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        title="Quotes"
        description="Start an offer from a template that already holds the plan and lines, then move it from quotation to confirmed to active."
        actions={admin && <Button variant="secondary" onClick={() => setParams({ new: '1' })}>New template</Button>}
      />

      <Section title="Templates" action={<span className="text-mute">{data.quoteTemplates.length} ready to use</span>}>
        <ul className="border-t border-ink">
          {data.quoteTemplates.map((template) => {
            const plan = lookups.plans.get(template.planId);
            return (
              <li key={template.id} className="grid gap-4 border-b border-line py-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="text-body font-semibold">{template.name}</div>
                  <div className="text-caption text-mute">{template.lines.map((line) => `${lookups.products.get(line.productId)?.name} × ${line.quantity}`).join(', ')}</div>
                </div>
                <div className="text-body">
                  <span className="tabular-nums font-medium">{money(lineTotal(template.lines))}</span><span className="text-mute"> per {intervalLabel[plan?.interval]} on {plan?.name}</span>
                  <div className="text-caption text-mute">Valid for {template.validityDays} days</div>
                </div>
                <Button size="sm" onClick={() => navigate(`/subscriptions?new=1&template=${template.id}`)}>Create quotation</Button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Open quotes" action={<span className="text-mute">Drafts, quotations and confirmed offers</span>}>
        <DataTable columns={columns} rows={open} onRowClick={(row) => navigate(`/subscriptions?view=${row.id}`)} empty="No open quotes. Create one from a template above." />
      </Section>

      {admin && params.get('new') && <TemplateForm data={data} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}
