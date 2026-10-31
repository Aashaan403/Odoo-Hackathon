import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { lineTotal, useApiMutation, useWorkspace } from '../lib/api.js';
import { addDaysIso, daysBetween, formatDate, intervalLabel, isoToday, money, monthLabel, monthLongLabel, plural } from '../lib/format.js';
import { Button } from '../components/Button.jsx';
import { Loading, Section, Stat } from '../components/Layout.jsx';
import { StepChart } from '../components/StepChart.jsx';

export function billedByMonth(invoices, months = 12) {
  const now = new Date();
  const keys = Array.from({ length: months }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1).toLocaleDateString('en-CA').slice(0, 7));
  const totals = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const invoice of invoices) {
    const key = invoice.issueDate.slice(0, 7);
    if (key in totals) totals[key] += invoice.total;
  }
  return keys.map((key) => ({ key, label: monthLabel(key), value: totals[key] }));
}

function ListRow({ to, lead, title, detail, detailTone, amount, amountNote }) {
  return (
    <li className="border-b border-line">
      <Link to={to} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-4 py-3 transition-colors hover:bg-plum-wash">
        <span className="text-body tabular-nums text-mute">{lead}</span>
        <span className="min-w-0">
          <span className="block truncate text-body font-medium">{title}</span>
          <span className={`block truncate text-caption ${detailTone === 'alarm' ? 'text-alarm' : 'text-mute'}`}>{detail}</span>
        </span>
        <span className="text-right">
          <span className="block text-body font-semibold tabular-nums">{amount}</span>
          <span className="block text-caption text-mute">{amountNote}</span>
        </span>
      </Link>
    </li>
  );
}

function HeroFigure({ value }) {
  const [whole, cents] = money(value).split('.');
  return (
    <p className="figure text-hero font-black">
      {whole}<span className="ml-1 align-top text-[0.4em] text-plum">.{cents}</span>
    </p>
  );
}

export default function Overview() {
  const { data, isLoading } = useWorkspace();
  const navigate = useNavigate();
  const billing = useApiMutation();
  const today = isoToday();

  const view = useMemo(() => {
    if (!data) return null;
    const monthKey = today.slice(0, 7);
    const weekAhead = addDaysIso(today, 7);
    const collected = data.payments.filter((payment) => payment.date.startsWith(monthKey)).reduce((sum, payment) => sum + payment.amount, 0);
    const due = data.subscriptions.filter((item) => item.status === 'Active' && item.nextBillingDate && item.nextBillingDate <= weekAhead).sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
    const overdue = data.invoices.filter((item) => item.status === 'Overdue').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { monthKey, collected, due, overdue, chart: billedByMonth(data.invoices) };
  }, [data, today]);

  if (isLoading || !view) return <Loading />;
  const { summary } = data;

  return (
    <div className="flex flex-col gap-14">
      <section className="border-b-2 border-ink pb-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <h1 className="text-lead font-medium">Monthly recurring revenue</h1>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" busy={billing.isPending} onClick={() => billing.mutate({ path: '/billing/run', success: (result) => (result.created ? `Billing run created ${plural(result.created, 'invoice')}.` : 'Billing run finished. Nothing was due.') })}>Run billing</Button>
            <Button onClick={() => navigate('/subscriptions?new=1')}>New subscription</Button>
          </div>
        </div>
        <div className="mt-6"><HeroFigure value={summary.mrr} /></div>
        <p className="mt-5 max-w-[60ch] text-lead text-mute">From {plural(summary.activeSubscriptions, 'active subscription')}, with yearly and weekly plans converted to their monthly value.</p>
      </section>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
        <Stat label={`Collected in ${monthLongLabel(view.monthKey).split(' ')[0]}`} value={money(view.collected)} />
        <Stat label="Outstanding" value={money(summary.outstanding)} note="Confirmed invoices not yet paid" />
        <Stat label="Overdue" value={money(summary.overdue)} tone={summary.overdue > 0 ? 'alarm' : undefined} note={plural(view.overdue.length, 'invoice')} />
        <Stat label="Billing in the next 7 days" value={view.due.length} note={view.due.length === 1 ? 'subscription' : 'subscriptions'} />
      </div>

      <Section title="Billed per month" action={<Link to="/reports" className="font-medium text-plum hover:underline">Open reports</Link>}>
        <StepChart points={view.chart} label="Invoice totals for the last twelve months" />
      </Section>

      <div className="grid gap-12 xl:grid-cols-2">
        <Section title="Due for billing" action={<span className="text-mute">Next 7 days</span>}>
          <ul className="border-t border-ink">
            {view.due.slice(0, 6).map((item) => (
              <ListRow key={item.id} to={`/subscriptions?view=${item.id}`} lead={formatDate(item.nextBillingDate).slice(0, -5)} title={item.customer?.company || item.customer?.name} detail={`${item.plan?.name} plan`} amount={money(lineTotal(item.lines))} amountNote={`per ${intervalLabel[item.plan?.interval] || 'month'}`} />
            ))}
            {!view.due.length && <li className="py-6 text-body text-mute">Nothing is due this week.</li>}
          </ul>
        </Section>

        <Section title="Overdue invoices" action={<Link to="/invoices?status=Overdue" className="font-medium text-plum hover:underline">See all</Link>}>
          <ul className="border-t border-ink">
            {view.overdue.slice(0, 6).map((invoice) => (
              <ListRow key={invoice.id} to={`/invoices?view=${invoice.id}`} lead={invoice.number} title={invoice.customer?.company || invoice.customer?.name} detail={`${plural(daysBetween(invoice.dueDate, today), 'day')} late`} detailTone="alarm" amount={money(invoice.outstanding)} amountNote="balance due" />
            ))}
            {!view.overdue.length && <li className="py-6 text-body text-mute">No overdue invoices. Every customer is paid up.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}
