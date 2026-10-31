# Brightloop · Subscription management

Brightloop runs the whole life of a subscription business in one place: products and plans, quotations, subscriptions, recurring invoices, discounts, tax, payments and revenue reporting, with a self-service portal for customers.

Built for the Odoo hackathon brief *Subscription Management System*.

## Run it

Requires Node.js 20.19 or newer.

```bash
npm install
npm run build   # builds the React app into web/dist
npm start       # serves the app and API on http://localhost:3000
```

For development, run the API and the Vite dev server side by side:

```bash
npm run dev:api   # API on :3000, restarts on change
npm run dev       # web app on :5173, /api proxied to :3000
```

`npm test` runs the billing rule tests.

### Demo accounts

All three use the password `Brightloop!2026`. The sign-in page lists them and fills them in on click.

| Role | Email | Sees |
| --- | --- | --- |
| Admin | `admin@brightloop.io` | Everything, including catalog, discounts and team |
| Staff | `staff@brightloop.io` | Customers, quotes, subscriptions, billing, payments, reports |
| Customer | `olivia@northstar.io` | Only Northstar Studio's own subscriptions and invoices |

On first start the server creates `data/brightloop.json` with a year of demo history: 36 customers, five plans, about 90 subscriptions in every lifecycle state, and the invoices and payments the billing engine produced for them. Delete the file to start fresh.

## How the brief maps to the app

| Scene in the brief | Where it lives |
| --- | --- |
| A new customer signs up | Sign up with a unique email; the password must be over 8 characters with upper, lower and special characters (checked live as you type). Forgot password sends a 30-minute reset link. Admin, staff and customer roles are enforced by the API; only admins add staff (**Team and access**). |
| Launching a new plan | **Catalog**: products with type, sales and cost price, notes and priced variants (the Odoo variant adds 560). Plans with price, daily/weekly/monthly/yearly billing, minimum quantity, availability window and per-plan rules: close automatically, close early, pause, renew. |
| Turning a quote into a subscription | **Quotes**: templates hold the plan and lines and a validity in days. Each subscription has a number, customer, plan, start and expiry dates, payment terms and lines with product, quantity, unit price, tax and amount, and moves Draft → Quotation → Confirmed → Active → Closed with a numbered progress bar. |
| Billing day | Billing runs hourly and on demand (**Run billing**). Each due period becomes one invoice with customer, lines, tax and totals filled in; a subscription is never billed twice for the same period and missed periods are caught up one invoice each. Invoices can be confirmed, sent, printed or cancelled and move Draft → Confirmed → Paid. |
| A customer asks for a better price | Admin-only discounts: fixed or percentage, minimum purchase or quantity, start and end dates, usage limit, whole-subscription or product scope. They apply to the next invoice automatically, before tax, and stop when expired or used up. |
| The money comes in | Record payments on an invoice with method, amount, date and note, including partial payments. **Payments** lists them all; invoices show paid, outstanding and overdue. |
| The finance lead, at the end of the month | **Overview** and **Reports**: MRR, active subscriptions, billed, collected, outstanding and overdue, filterable by date range, plan, customer and status, with a monthly chart, revenue by plan and CSV export. |

## Under the hood

```
server.js         HTTP API, sessions, roles, billing scheduler, static hosting of web/dist
lib/billing.js    Pure pricing, tax, discount and billing-calendar rules (shared with the tests)
lib/store.js      Atomic JSON file store and the demo workspace seed
test/             node:test checks for the billing rules
web/src/          React 19 app (Vite, React Router, TanStack Query, Tailwind CSS v4)
  components/     Design system: tables, drawers, fields, status marks, lifecycle steps, step chart
  pages/          One folder or file per screen
```

- **Pricing** lives in one function, `priceLines`, used both for invoices and for the live price preview on the subscription form, so what staff see is what customers are billed.
- **Billing dates** keep their anchor day (a subscription started on the 31st bills on the 30th or 28th in shorter months and returns to the 31st).
- **Speed**: workspace data is assembled in a single pass over payments with id lookups, and long tables page on the client. With the demo workspace the main data request answers in about 25 ms.
- **Security**: passwords are salted scrypt hashes, sessions are HTTP-only same-site cookies, sign-in is rate limited, and every API route checks the caller's role and, for customers, ownership of the record.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default 3000 |
| `EMAIL_API_URL`, `EMAIL_API_KEY` | HTTP email gateway for password resets and invoices (JSON POST with `to`, `subject`, `text`, `html`). Without it, development reset links appear on screen and invoice emails wait in a local outbox. |
| `PUBLIC_URL` | External URL used in emailed links |
| `BUSINESS_TIME_ZONE` | Business date for billing, default `Asia/Kolkata` |
| `ADMIN_PASSWORD` | Required on first production start (`NODE_ENV=production`); the demo password is never used in production |

The JSON store suits a single-instance demo. A multi-instance deployment would move to a transactional database and a shared session store.
