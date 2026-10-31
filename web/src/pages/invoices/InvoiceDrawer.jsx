import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiMutation } from '../../lib/api.js';
import { daysBetween, formatDate, isoToday, money, plural } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { Drawer } from '../../components/Drawer.jsx';
import { Field, FormGrid, Input, Select } from '../../components/Field.jsx';
import { Section, Totals } from '../../components/Layout.jsx';
import { INVOICE_STEPS, Lifecycle } from '../../components/Lifecycle.jsx';
import { StatusTag } from '../../components/StatusTag.jsx';

export const PAYMENT_METHODS = [['card', 'Card'], ['bank transfer', 'Bank transfer'], ['direct debit', 'Direct debit'], ['cash', 'Cash'], ['other', 'Other']];

function PaymentForm({ invoice, onDone }) {
  const [form, setForm] = useState({ amount: invoice.outstanding, method: 'bank transfer', date: isoToday(), note: '' });
  const record = useApiMutation({ onSuccess: onDone });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  return (
    <form className="flex flex-col gap-4 border border-ink p-5" onSubmit={(event) => { event.preventDefault(); record.mutate({ path: `/invoices/${invoice.id}/payments`, body: { ...form, amount: Number(form.amount) }, success: `Payment of ${money(form.amount)} recorded against ${invoice.number}.` }); }}>
      <FormGrid>
        <Field label="Amount" hint={`Balance due ${money(invoice.outstanding)}`}><Input type="number" step="0.01" min="0.01" max={invoice.outstanding} value={form.amount} onChange={set('amount')} required /></Field>
        <Field label="Method"><Select value={form.method} onChange={set('method')}>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Payment date"><Input type="date" value={form.date} max={isoToday()} onChange={set('date')} required /></Field>
        <Field label="Note" hint="Optional, such as a bank reference"><Input value={form.note} onChange={set('note')} maxLength={500} /></Field>
      </FormGrid>
      <div className="flex gap-3"><Button type="submit" busy={record.isPending}>Record payment</Button><Button variant="quiet" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}

export function InvoiceDrawer({ invoice, data, onClose }) {
  const [paying, setPaying] = useState(false);
  const mutation = useApiMutation();
  if (!invoice) return null;

  const staff = data.user.role !== 'customer';
  const payments = data.payments.filter((payment) => payment.invoiceId === invoice.id);
  const daysLate = invoice.status === 'Overdue' ? daysBetween(invoice.dueDate, isoToday()) : 0;
  const act = (action, success) => mutation.mutate({ path: `/invoices/${invoice.id}/action`, body: { action }, success });
  const busy = (action) => mutation.isPending && mutation.variables?.body?.action === action;

  return (
    <Drawer open onClose={onClose} kicker={invoice.customer?.company || invoice.customer?.name} title={invoice.number} wide
      footer={(
        <>
          {staff && invoice.status === 'Draft' && <Button busy={busy('confirm')} onClick={() => act('confirm', `${invoice.number} confirmed.`)}>Confirm</Button>}
          {staff && !invoice.sentAt && <Button variant={invoice.status === 'Draft' ? 'secondary' : 'primary'} busy={busy('send')} onClick={() => act('send', (result) => (result.deliveryStatus === 'delivered' ? `${invoice.number} emailed to ${invoice.customer?.email}.` : `${invoice.number} queued for email. Add an email gateway to deliver it.`))}>Send</Button>}
          {staff && invoice.deliveryStatus === 'queued' && <Button variant="secondary" busy={busy('resend')} onClick={() => act('resend', `${invoice.number} emailed.`)}>Retry email</Button>}
          {staff && invoice.outstanding > 0 && !paying && <Button variant="plum" onClick={() => setPaying(true)}>Record payment</Button>}
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
          {staff && ['Draft', 'Confirmed', 'Overdue'].includes(invoice.status) && !payments.length && <Button variant="danger" busy={busy('cancel')} onClick={() => act('cancel', `${invoice.number} cancelled.`)}>Cancel invoice</Button>}
        </>
      )}>
      <div className="flex flex-col gap-10">
        <div className="no-print flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <StatusTag status={invoice.status} />
            {invoice.subscription && <Link to={`/subscriptions?view=${invoice.subscription.id}`} className="text-body text-mute hover:text-plum">From {invoice.subscription.number}</Link>}
            {invoice.sentAt && <span className="text-body text-mute">Sent {formatDate(invoice.sentAt)}</span>}
          </div>
          <Lifecycle steps={INVOICE_STEPS} current={invoice.status === 'Overdue' ? 'Confirmed' : invoice.status} note={invoice.status === 'Overdue' ? `Overdue by ${plural(daysLate, 'day')}. ${money(invoice.outstanding)} is still owed.` : undefined} />
        </div>

        {paying && <PaymentForm invoice={invoice} onDone={() => setPaying(false)} />}

        <article className="print-area flex flex-col gap-8">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-5">
            <div>
              <div className="text-title font-black tracking-tight" style={{ fontStretch: '112%' }}>brightloop</div>
              <div className="mt-1 text-caption text-mute">Brightloop Software</div>
            </div>
            <div className="text-right">
              <div className="figure text-figure font-extrabold">Invoice {invoice.number}</div>
              <div className="mt-1 text-body text-mute">Billing period starting {formatDate(invoice.billingPeriod || invoice.issueDate)}</div>
            </div>
          </header>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-caption text-mute">Bill to</div>
              <div className="mt-1 text-body font-semibold">{invoice.customer?.company || invoice.customer?.name}</div>
              <div className="text-body">{invoice.customer?.name}</div>
              <div className="text-body text-mute">{invoice.customer?.email}</div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-body sm:text-right">
              <div><dt className="text-caption text-mute">Issued</dt><dd className="font-medium tabular-nums">{formatDate(invoice.issueDate)}</dd></div>
              <div><dt className="text-caption text-mute">Due</dt><dd className={`font-medium tabular-nums ${invoice.status === 'Overdue' ? 'text-alarm' : ''}`}>{formatDate(invoice.dueDate)}</dd></div>
            </dl>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-body">
              <thead><tr className="border-b border-ink text-caption text-mute"><th className="py-2 text-left font-medium">Description</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Unit price</th><th className="py-2 text-right font-medium">Tax</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
              <tbody>
                {invoice.lines.map((line, index) => (
                  <tr key={index} className="border-b border-line">
                    <td className="py-3 pr-4"><span className="block font-medium">{line.description}</span>{line.variant && <span className="block text-caption text-mute">{line.variant} variant</span>}{line.discountAmount > 0 && <span className="block text-caption text-plum">Discount −{money(line.discountAmount)}</span>}</td>
                    <td className="py-3 text-right tabular-nums">{line.quantity}</td>
                    <td className="py-3 text-right tabular-nums">{money(line.unitPrice)}</td>
                    <td className="py-3 text-right tabular-nums text-mute">{line.taxRate}%</td>
                    <td className="py-3 text-right font-medium tabular-nums">{money(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Totals rows={[
            ['Subtotal', money(invoice.subtotal)],
            invoice.discountAmount > 0 && ['Discount', `−${money(invoice.discountAmount)}`],
            ['Tax', money(invoice.taxAmount)],
            ['Total', money(invoice.total), true],
            invoice.paid > 0 && ['Paid', `−${money(invoice.paid)}`],
            invoice.paid > 0 && ['Balance due', money(invoice.outstanding), true],
          ]} />
        </article>

        <Section className="no-print" title="Payments" action={<span className="text-mute">{money(invoice.paid)} of {money(invoice.total)}</span>}>
          {payments.length ? (
            <ul className="border-t border-ink">
              {payments.map((payment) => (
                <li key={payment.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-3 text-body">
                  <span className="tabular-nums text-mute">{formatDate(payment.date)}</span>
                  <span className="min-w-0"><span className="block font-medium capitalize">{payment.method}</span>{payment.note && <span className="block truncate text-caption text-mute">{payment.note}</span>}</span>
                  <span className="font-semibold tabular-nums">{money(payment.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-body text-mute">No payments recorded yet.</p>}
        </Section>
      </div>
    </Drawer>
  );
}
