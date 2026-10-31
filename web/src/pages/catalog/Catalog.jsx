import { useSearchParams } from 'react-router-dom';
import { useLookups, useWorkspace } from '../../lib/api.js';
import { formatDate, intervalLabel, isoToday, money } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Loading, PageHeader } from '../../components/Layout.jsx';
import { StatusTag } from '../../components/StatusTag.jsx';
import { Tabs } from '../../components/Tabs.jsx';
import { DiscountForm, PlanForm, ProductForm, TaxForm } from './CatalogForms.jsx';

const TABS = [['products', 'Products', 'product'], ['plans', 'Plans', 'plan'], ['taxes', 'Taxes', 'tax rule'], ['discounts', 'Discounts', 'discount']];

export function discountState(rule, today = isoToday()) {
  if (!rule.active) return 'Off';
  if (rule.endDate && rule.endDate < today) return 'Expired';
  if (rule.maxUses && rule.usedCount >= rule.maxUses) return 'Used up';
  if (rule.startDate > today) return 'Scheduled';
  return 'Active';
}

const muted = (text) => <span className="text-mute">{text}</span>;

export default function Catalog() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const [params, setParams] = useSearchParams();
  if (isLoading || !lookups) return <Loading />;

  const tab = TABS.find(([key]) => key === params.get('tab')) ? params.get('tab') : 'products';
  const admin = data.user.role === 'admin';
  const editId = params.get('edit');
  const close = () => setParams({ tab }, { replace: true });
  const open = (id) => admin && setParams({ tab, edit: id });
  const activeProducts = data.products.filter((product) => product.active);

  const tables = {
    products: { rows: data.products, columns: [
      { key: 'name', header: 'Product', render: (row) => <><span className="block font-semibold">{row.name}</span><span className="block max-w-[38ch] truncate text-caption text-mute">{row.notes}</span></> },
      { key: 'type', header: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
      { key: 'sales', header: 'Sales price', align: 'right', render: (row) => <span className="tabular-nums">{money(row.salesPrice)}</span> },
      { key: 'cost', header: 'Cost price', align: 'right', render: (row) => <span className="tabular-nums text-mute">{money(row.costPrice)}</span> },
      { key: 'margin', header: 'Margin', align: 'right', render: (row) => <span className="tabular-nums">{row.salesPrice ? `${Math.round(((row.salesPrice - row.costPrice) / row.salesPrice) * 100)}%` : '—'}</span> },
      { key: 'variants', header: 'Variants', render: (row) => (row.variants?.length ? row.variants.map((variant) => <span key={variant.name} className="block">{variant.name}{variant.priceDelta ? <span className="text-mute tabular-nums"> +{money(variant.priceDelta)}</span> : ''}</span>) : muted('None')) },
      { key: 'status', header: 'Status', render: (row) => <StatusTag status={row.active ? 'Active' : 'Archived'} /> },
    ] },
    plans: { rows: data.plans, columns: [
      { key: 'name', header: 'Plan', render: (row) => <><span className="block font-semibold">{row.name}</span><span className="block text-caption text-mute">{lookups.products.get(row.productId)?.name}</span></> },
      { key: 'price', header: 'Price', align: 'right', render: (row) => <><span className="block tabular-nums">{money(row.price)}</span><span className="block text-caption text-mute">per unit, every {intervalLabel[row.interval]}</span></> },
      { key: 'min', header: 'Min. qty', align: 'right', render: (row) => <span className="tabular-nums">{row.minQuantity}</span> },
      { key: 'window', header: 'On sale', render: (row) => <span className="tabular-nums">{formatDate(row.availableFrom)} to {row.availableTo ? formatDate(row.availableTo) : 'open'}</span> },
      { key: 'rules', header: 'Subscribers can', render: (row) => [row.allowPause && 'pause', row.allowEarlyClose && 'close early', row.allowRenew && 'renew'].filter(Boolean).join(', ') || muted('only wait for expiry') },
      { key: 'end', header: 'At expiry', render: (row) => (row.autoClose ? 'Closes itself' : muted('Keeps running')) },
      { key: 'status', header: 'Status', render: (row) => <StatusTag status={row.active ? 'Active' : 'Archived'} /> },
    ] },
    taxes: { rows: data.taxes, columns: [
      { key: 'name', header: 'Tax rule', render: (row) => <span className="font-semibold">{row.name}</span> },
      { key: 'rate', header: 'Rate', align: 'right', render: (row) => <span className="tabular-nums">{Number(row.rate).toFixed(2)}%</span> },
      { key: 'status', header: 'Status', render: (row) => <StatusTag status={row.active ? 'On' : 'Off'} /> },
      { key: 'usage', header: 'Used on', render: (row) => muted(`${data.subscriptions.filter((item) => item.lines.some((line) => line.taxIds?.includes(row.id))).length} subscriptions`) },
    ] },
    discounts: { rows: data.discounts, columns: [
      { key: 'name', header: 'Discount', render: (row) => <span className="font-semibold">{row.name}</span> },
      { key: 'value', header: 'Value', align: 'right', render: (row) => <span className="tabular-nums">{row.type === 'percentage' ? `${row.value}%` : money(row.value)}</span> },
      { key: 'scope', header: 'Applies to', render: (row) => (row.scope === 'products' && row.productIds?.length ? row.productIds.map((id) => lookups.products.get(id)?.name).join(', ') : 'Whole subscription') },
      { key: 'conditions', header: 'Conditions', render: (row) => <><span className="block tabular-nums">From {row.minimumQuantity} units</span>{row.minimumPurchase > 0 && <span className="block text-caption text-mute">and {money(row.minimumPurchase)} subtotal</span>}</> },
      { key: 'dates', header: 'Valid', render: (row) => <span className="tabular-nums">{formatDate(row.startDate)} to {row.endDate ? formatDate(row.endDate) : 'open'}</span> },
      { key: 'uses', header: 'Uses', render: (row) => (
        <div className="w-28">
          <span className="text-body tabular-nums">{row.usedCount}{row.maxUses ? ` of ${row.maxUses}` : ''}</span>
          {row.maxUses > 0 && <div className="mt-1 h-1 bg-line"><div className="h-full bg-plum" style={{ width: `${Math.min(100, (row.usedCount / row.maxUses) * 100)}%` }} /></div>}
        </div>
      ) },
      { key: 'status', header: 'Status', render: (row) => <StatusTag status={discountState(row)} /> },
    ] },
  };

  const [, , singular] = TABS.find(([key]) => key === tab);
  const editing = editId === 'new' ? {} : tables[tab].rows.find((row) => row.id === editId);
  const formProps = { record: editId === 'new' ? undefined : editing, onClose: close, products: activeProducts };

  return (
    <div>
      <PageHeader
        title="Catalog"
        description={admin ? 'What Brightloop sells and how it is priced. Changes apply to the next invoices that are created.' : 'Products, plans, taxes and discounts. Only an administrator can change them.'}
        actions={admin && <Button onClick={() => setParams({ tab, edit: 'new' })}>New {singular}</Button>}
      />
      <Tabs label="Catalog sections" value={tab} onChange={(value) => setParams({ tab: value })} items={TABS.map(([key, label]) => ({ value: key, label, count: tables[key].rows.length }))} />
      <div className="pt-6">
        <DataTable columns={tables[tab].columns} rows={tables[tab].rows} onRowClick={admin ? (row) => open(row.id) : undefined} empty={`No ${TABS.find(([key]) => key === tab)[1].toLowerCase()} yet.`} />
      </div>
      {admin && editing && tab === 'products' && <ProductForm key={editId} {...formProps} />}
      {admin && editing && tab === 'plans' && <PlanForm key={editId} {...formProps} />}
      {admin && editing && tab === 'taxes' && <TaxForm key={editId} {...formProps} />}
      {admin && editing && tab === 'discounts' && <DiscountForm key={editId} {...formProps} />}
    </div>
  );
}
