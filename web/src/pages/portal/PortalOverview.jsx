import { Link } from 'react-router-dom';
import { lineTotal, useWorkspace } from '../../lib/api.js';
import { formatDate, intervalLabel, money } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { Loading, PageHeader, Section, Stat } from '../../components/Layout.jsx';
import { StatusTag } from '../../components/StatusTag.jsx';

export default function PortalOverview() {
  const { data, isLoading } = useWorkspace();
  if (isLoading) return <Loading />;

  const active = data.subscriptions.filter((item) => item.status === 'Active');
  const next = active.slice().sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate))[0];
  const owed = data.invoices.reduce((sum, invoice) => sum + invoice.outstanding, 0);
  const overdue = data.invoices.filter((invoice) => invoice.status === 'Overdue');
  const company = data.subscriptions[0]?.customer?.company || data.user.name;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader title={company} description="Your subscriptions and invoices with Brightloop, all in one place. Nothing here needs an email to support." actions={<Link to="/plans"><Button>Browse plans</Button></Link>} />

      {overdue.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-alarm bg-alarm/5 px-5 py-4">
          <p className="text-body"><span className="font-semibold text-alarm">{overdue.length === 1 ? `${overdue[0].number} is overdue.` : `${overdue.length} invoices are overdue.`}</span> {money(overdue.reduce((sum, invoice) => sum + invoice.outstanding, 0))} is past its due date.</p>
          <Link to={`/invoices?view=${overdue[0].id}`} className="text-body font-semibold text-alarm underline underline-offset-4">View invoice</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
        <Stat label="Active subscriptions" value={active.length} />
        <Stat label="Next invoice" value={next ? formatDate(next.nextBillingDate) : 'None scheduled'} note={next ? `${money(lineTotal(next.lines))} before tax for ${next.plan?.name}` : undefined} />
        <Stat label="Balance due" value={money(owed)} tone={overdue.length ? 'alarm' : undefined} note={owed ? 'Across your open invoices' : 'You are all paid up'} />
      </div>

      <div className="grid gap-12 xl:grid-cols-2">
        <Section title="Your subscriptions" action={<Link to="/subscriptions" className="font-medium text-plum hover:underline">Manage</Link>}>
          <ul className="border-t border-ink">
            {data.subscriptions.map((item) => (
              <li key={item.id} className="border-b border-line">
                <Link to={`/subscriptions?view=${item.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 hover:bg-plum-wash">
                  <span className="min-w-0"><span className="block truncate text-body font-medium">{item.plan?.name} plan</span><span className="block text-caption text-mute">{item.number}, since {formatDate(item.startDate)}</span></span>
                  <span className="flex items-center gap-5"><StatusTag status={item.status} /><span className="text-body tabular-nums">{money(lineTotal(item.lines))}<span className="text-mute"> / {intervalLabel[item.plan?.interval]}</span></span></span>
                </Link>
              </li>
            ))}
            {!data.subscriptions.length && <li className="py-6 text-body text-mute">You have no subscriptions yet. Choose a plan to get started.</li>}
          </ul>
        </Section>

        <Section title="Recent invoices" action={<Link to="/invoices" className="font-medium text-plum hover:underline">See all</Link>}>
          <ul className="border-t border-ink">
            {data.invoices.slice().sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 6).map((invoice) => (
              <li key={invoice.id} className="border-b border-line">
                <Link to={`/invoices?view=${invoice.id}`} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-4 py-3 hover:bg-plum-wash">
                  <span className="text-body font-semibold tabular-nums">{invoice.number}</span>
                  <span className="flex items-center gap-4"><span className="text-body text-mute tabular-nums">{formatDate(invoice.issueDate)}</span><StatusTag status={invoice.status} /></span>
                  <span className="text-body font-medium tabular-nums">{money(invoice.total)}</span>
                </Link>
              </li>
            ))}
            {!data.invoices.length && <li className="py-6 text-body text-mute">No invoices yet.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}
