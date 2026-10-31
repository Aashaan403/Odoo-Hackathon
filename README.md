# Brightloop subscription management

Brightloop is a full-stack subscription operations app for the hackathon brief. It includes customer accounts, staff roles, product variants, billing plans, quotes, recurring invoices, discounts, tax, payment recording, reporting, and a customer portal.

## Run locally

Requires Node.js 20 or newer. There are no external npm dependencies.

```powershell
npm start
```

Open [http://localhost:3000](http://localhost:3000). On the first run, the server creates `data/brightloop.json` with sample workspace data. That runtime database is ignored by Git.

## Demo sign-ins

Use `Brightloop!2026` for each demo account:

- Admin: `admin@brightloop.io`
- Staff: `staff@brightloop.io`
- Customer portal: `olivia@northstar.io`

The initial records include sample customers, three plans, products and variants, a tax rule, a discount, quote templates, subscriptions, an invoice, and a payment. The data file is created once and kept between server restarts; remove it to rebuild the original sample workspace.

## Main workflows

- Sign up with a unique email and a password over eight characters containing uppercase, lowercase, and a special character. Password reset tokens expire after 30 minutes.
- Admins manage team access, products, variants, plans, taxes, discounts, and quote templates. Staff manage customers, quotes, subscriptions, invoices, billing runs, and payments.
- Customers can browse plans, start a subscription, and see only their own subscriptions and invoices. Plan rules control pausing, early closure, renewal, availability, and automatic expiry.
- A quotation template creates a time-limited quote. Move it through Confirmed and Active to begin recurring billing.
- Billing runs hourly and can also be started from the Overview or Invoices page. Each due billing period is recorded once. Invoices snapshot subscription lines, tax, discounts, issue date, and payment terms.
- Confirm, send, cancel, print, or record full and partial payments on invoices. Reports summarize active subscriptions, monthly recurring revenue, collected payments, open balances, and overdue invoices. Export report rows as CSV.

## Email delivery

Set `EMAIL_API_URL` to an HTTP email gateway that accepts a JSON POST containing `to`, `subject`, `text`, and `html`. Set `EMAIL_API_KEY` if the gateway uses bearer-token authentication. Set `PUBLIC_URL` to the externally reachable app URL when generating links behind a proxy. Password resets and invoice emails use this gateway. Without it, development password resets show a one-time link in the app and sent invoice emails are saved in the local outbox queue.

Example environment setup in PowerShell:

```powershell
$env:EMAIL_API_URL = 'https://your-mail-gateway.example/send'
$env:EMAIL_API_KEY = 'your-api-key'
$env:PUBLIC_URL = 'https://billing.example.com'
npm start
```

The business date defaults to `Asia/Kolkata`; override with `BUSINESS_TIME_ZONE` if needed. Override the port with `PORT`.

## Storage and deployment

The app uses Node's built-in HTTP server and an atomic JSON-file store for a self-contained hackathon setup. Session cookies are HTTP-only and same-site; passwords are stored as salted scrypt hashes. The JSON store is suited to a single-instance demo deployment. A production multi-instance deployment should use a transactional database and a shared session store.
