import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, useApiMutation } from '../../lib/api.js';
import { formatDate, intervalLabel, money } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { Drawer } from '../../components/Drawer.jsx';
import { DetailList, Section, Totals } from '../../components/Layout.jsx';
import { Lifecycle, SUBSCRIPTION_STEPS } from '../../components/Lifecycle.jsx';
import { StatusTag } from '../../components/StatusTag.jsx';

const ACTIONS = {
  quotation: { label: 'Mark as quotation', done: 'Marked as quotation.' },
  confirm: { label: 'Confirm', done: 'Subscription confirmed.' },
  activate: { label: 'Activate', done: 'Subscription activated. Billing starts today.' },
  pause: { label: 'Pause', done: 'Subscription paused.', variant: 'secondary' },
  resume: { label: 'Resume', done: 'Subscription resumed.' },
  close: { label: 'Close', done: 'Subscription closed.', variant: 'danger' },
  renew: { label: 'Renew', done: 'Subscription renewed.' },
};

// Mirrors the server's transition table and plan rules so only valid buttons are offered.
export function availableActions(subscription, plan, role) {
  const staff = role !== 'customer';
  const byStatus = {
    Draft: staff ? ['quotation', 'close'] : [],
    Quotation: staff ? ['confirm', 'close'] : [],
    Confirmed: staff ? ['activate', 'close'] : [],
    Active: ['pause', 'close'],
    Paused: ['resume', 'close'],
    Closed: ['renew'],
  }[subscription.status] || [];
  return byStatus.filter((action) => (action !== 'pause' || plan?.allowPause) && (action !== 'close' || plan?.allowEarlyClose) && (action !== 'renew' || plan?.allowRenew));
}

function planRules(plan) {
  if (!plan) return '—';
  const rules = [plan.allowPause && 'pause', plan.allowEarlyClose && 'close early', plan.allowRenew && 'renew'].filter(Boolean);
  return `${rules.length ? `Can ${rules.join(', ')}` : 'Fixed term'}${plan.autoClose ? '; closes at expiry' : ''}`;
}

export function SubscriptionDrawer({ subscription, data, lookups, onClose }) {
  const navigate = useNavigate();
  const mutation = useApiMutation();
  const plan = subscription && lookups.plans.get(subscription.planId);
  const customer = subscription && lookups.customers.get(subscription.customerId);
  const preview = useQuery({
    queryKey: ['preview', subscription?.id, subscription?.lines, subscription?.discountId],
    queryFn: () => api('/subscriptions/preview', { method: 'POST', body: { planId: subscription.planId, lines: subscription.lines, discountId: subscription.discountId } }),
    enabled: Boolean(subscription),
  });
  if (!subscription) return null;

  const role = data.user.role;
  const invoices = (lookups.invoicesBySubscription.get(subscription.id) || []).slice().sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const discount = lookups.discounts.get(subscription.discountId);
  const run = (action) => mutation.mutate({ path: `/subscriptions/${subscription.id}/action`, body: { action }, success: ACTIONS[action].done });
  const actions = availableActions(subscription, plan, role);
  const priced = preview.data;

  return (
    <Drawer
      open
      onClose={onClose}
      kicker={customer?.company || customer?.name}
      title={subscription.number}
      wide
      footer={(
        <>
          {actions.map((action) => <Button key={action} variant={ACTIONS[action].variant || 'primary'} busy={mutation.isPending && mutation.variables?.body?.action === action} onClick={() => run(action)}>{ACTIONS[action].label}</Button>)}
          {role !== 'customer' && subscription.status === 'Active' && (
            <Button variant="secondary" onClick={() => mutation.mutate({ path: '/invoices', body: { subscriptionId: subscription.id }, success: (invoice) => `Invoice ${invoice.number} created.` })}>Invoice today</Button>
          )}
          {!actions.length && <span className="text-body text-mute">No actions are available in this state.</span>}
        </>
      )}
    >
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><StatusTag status={subscription.status} /><span className="text-body text-mute">{plan?.name} plan, billed every {intervalLabel[plan?.interval] || 'month'}</span></div>
          <Lifecycle steps={SUBSCRIPTION_STEPS} current={subscription.status === 'Paused' ? 'Active' : subscription.status} note={subscription.status === 'Paused' ? 'Paused. No invoices are created until it is resumed.' : undefined} />
        </div>

        <DetailList items={[
          ['Customer', customer?.name],
          ['Start date', formatDate(subscription.startDate)],
          ['Expiry date', subscription.expiryDate ? formatDate(subscription.expiryDate) : 'Runs until closed'],
          ['Next invoice', ['Active'].includes(subscription.status) ? formatDate(subscription.nextBillingDate) : '—'],
          ['Payment terms', `${subscription.paymentTermsDays} days`],
          ['Discount', discount?.name || 'None'],
          ['Plan rules', planRules(plan)],
          subscription.quoteTemplateId && ['From template', data.quoteTemplates?.find((item) => item.id === subscription.quoteTemplateId)?.name || 'Quotation template'],
        ]} />

        <Section title="Order lines">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-body">
              <thead><tr className="border-b border-ink text-caption text-mute"><th className="py-2 text-left font-medium">Product</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Unit price</th><th className="py-2 text-right font-medium">Tax</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
              <tbody>
                {(priced?.lines || subscription.lines).map((line, index) => (
                  <tr key={index} className="border-b border-line">
                    <td className="py-3 pr-4"><span className="block font-medium">{line.description || lookups.products.get(line.productId)?.name}</span>{line.variant && <span className="block text-caption text-mute">{line.variant} variant</span>}</td>
                    <td className="py-3 text-right tabular-nums">{line.quantity}</td>
                    <td className="py-3 text-right tabular-nums">{money(line.unitPrice)}</td>
                    <td className="py-3 text-right tabular-nums text-mute">{line.taxRate !== undefined ? `${line.taxRate}%` : '—'}</td>
                    <td className="py-3 text-right font-medium tabular-nums">{money(line.amount ?? line.quantity * line.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {priced && (
            <div className="mt-4">
              <Totals rows={[
                ['Subtotal', money(priced.subtotal)],
                priced.discountAmount > 0 && [`Discount (${discount?.name})`, `−${money(priced.discountAmount)}`],
                ['Tax', money(priced.taxAmount)],
                [`Each ${intervalLabel[plan?.interval] || 'period'}`, money(priced.total), true],
              ]} />
            </div>
          )}
        </Section>

        <Section title="Invoices" action={<span className="text-mute">{invoices.length} so far</span>}>
          {invoices.length ? (
            <ul className="border-t border-ink">
              {invoices.slice(0, 8).map((invoice) => (
                <li key={invoice.id} className="border-b border-line">
                  <button onClick={() => navigate(`/invoices?view=${invoice.id}`)} className="grid w-full grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-4 py-3 text-left transition-colors hover:bg-plum-wash">
                    <span className="font-medium tabular-nums">{invoice.number}</span>
                    <span className="flex items-center gap-4"><span className="text-mute tabular-nums">{formatDate(invoice.issueDate)}</span><StatusTag status={invoice.status} /></span>
                    <span className="font-medium tabular-nums">{money(invoice.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-body text-mute">No invoices yet. The first one is created on the start date once the subscription is active.</p>}
        </Section>
      </div>
    </Drawer>
  );
}
