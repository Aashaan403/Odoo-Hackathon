import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Button } from '../components/Button.jsx';
import { Field, FormError, Input } from '../components/Field.jsx';

const DEMO_PASSWORD = 'Brightloop!2026';
const DEMO_ACCOUNTS = [
  ['Admin', 'admin@brightloop.io', 'Sets up products, plans, taxes and discounts'],
  ['Staff', 'staff@brightloop.io', 'Runs quotes, billing and payments'],
  ['Customer', 'olivia@northstar.io', 'Northstar Studio, sees only its own account'],
];

export const passwordIsStrong = (value) => PASSWORD_RULES.every(([, test]) => test(value));

const PASSWORD_RULES = [
  ['More than 8 characters', (value) => value.length > 8],
  ['An uppercase letter', (value) => /[A-Z]/.test(value)],
  ['A lowercase letter', (value) => /[a-z]/.test(value)],
  ['A special character', (value) => /[^A-Za-z0-9]/.test(value)],
];

const COPY = {
  login: { title: 'Sign in', lead: 'Pick up where the billing month left off.', submit: 'Sign in' },
  signup: { title: 'Create your account', lead: 'Customers see their subscriptions and invoices without emailing anyone.', submit: 'Create account' },
  forgot: { title: 'Reset your password', lead: 'We will send a reset link to the email on your account.', submit: 'Send reset link' },
  reset: { title: 'Choose a new password', lead: 'The link is valid for 30 minutes.', submit: 'Save new password' },
};

export function PasswordRules({ value }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1" aria-label="Password rules">
      {PASSWORD_RULES.map(([label, test]) => {
        const met = test(value);
        return (
          <li key={label} className={`flex items-center gap-2 text-caption ${met ? 'text-ink' : 'text-mute'}`}>
            <span aria-hidden className={`size-2 ${met ? 'bg-plum' : 'border border-faint'}`} />
            {label}
            <span className="sr-only">{met ? 'met' : 'not met'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', company: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [resetLink, setResetLink] = useState('');
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const passwordOk = PASSWORD_RULES.every(([, test]) => test(form.password));

  async function submit(event) {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      if (mode === 'login' || mode === 'signup') {
        const body = mode === 'login' ? { email: form.email, password: form.password } : { name: form.name, company: form.company, email: form.email, password: form.password };
        const result = await api(mode === 'login' ? '/auth/login' : '/auth/signup', { method: 'POST', body });
        queryClient.removeQueries({ queryKey: ['workspace'] });
        queryClient.setQueryData(['session'], { user: result.user });
        navigate('/', { replace: true });
      } else if (mode === 'forgot') {
        const result = await api('/auth/password-reset', { method: 'POST', body: { email: form.email } });
        setNotice('If that email has an account, a reset link is on its way.');
        setResetLink(result.resetLink || '');
      } else {
        if (form.password !== form.confirm) throw new Error('The two passwords do not match.');
        const result = await api('/auth/password-reset/complete', { method: 'POST', body: { token: params.get('token'), password: form.password } });
        navigate('/login', { replace: true, state: { notice: result.message } });
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside className="flex flex-col justify-between gap-12 border-b-2 border-ink px-6 py-8 sm:px-10 lg:border-r lg:border-b-0 lg:border-line lg:py-10">
        <Wordmark />
        <div>
          <p className="figure max-w-[11ch] text-hero font-black">Recurring billing, run in one place.</p>
          <p className="mt-6 max-w-md text-body text-mute">Products, plans, quotations, subscriptions, invoices, payments and revenue, from the first signup to the month-end numbers.</p>
        </div>
        {mode === 'login' && (
          <div className="hidden lg:block">
            <p className="text-caption text-mute">Demo accounts share the password <span className="font-semibold text-ink">{DEMO_PASSWORD}</span></p>
            <ul className="mt-3 border-t border-line">
              {DEMO_ACCOUNTS.map(([role, email, summary]) => (
                <li key={email} className="border-b border-line">
                  <button type="button" onClick={() => setForm({ ...form, email, password: DEMO_PASSWORD })} className="group flex w-full items-baseline gap-4 py-3 text-left">
                    <span className="w-20 shrink-0 text-body font-semibold group-hover:text-plum">{role}</span>
                    <span className="min-w-0 flex-1 truncate text-body">{email}</span>
                    <span className="hidden text-caption text-mute xl:inline">{summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <main className="flex items-center px-6 py-12 sm:px-10">
        <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-5" noValidate={false}>
          <div>
            <h1 className="figure text-page font-extrabold">{copy.title}</h1>
            <p className="mt-3 text-body text-mute">{copy.lead}</p>
          </div>
          {notice && <p role="status" className="border-l-2 border-plum bg-plum-wash px-3 py-2 text-body">{notice}{resetLink && <> <Link className="font-semibold text-plum underline underline-offset-2" to={resetLink}>Open the reset link</Link> (shown because email delivery is not configured)</>}</p>}
          <FormError error={error} />

          {mode === 'signup' && (
            <>
              <Field label="Full name"><Input required autoComplete="name" value={form.name} onChange={set('name')} /></Field>
              <Field label="Company" hint="Optional"><Input autoComplete="organization" value={form.company} onChange={set('company')} /></Field>
            </>
          )}
          {mode !== 'reset' && <Field label="Email"><Input required type="email" autoComplete="email" value={form.email} onChange={set('email')} /></Field>}
          {mode !== 'forgot' && (
            <Field label={mode === 'reset' ? 'New password' : 'Password'}>
              <Input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} />
              {mode !== 'login' && <PasswordRules value={form.password} />}
            </Field>
          )}
          {mode === 'reset' && <Field label="Repeat new password"><Input required type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} /></Field>}

          <Button type="submit" busy={busy} disabled={(mode === 'signup' || mode === 'reset') && !passwordOk} className="mt-1 w-full">{copy.submit}</Button>

          <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-4 text-body">
            {mode === 'login' && <><Link to="/signup" className="font-medium hover:text-plum">Create an account</Link><Link to="/forgot-password" className="text-mute hover:text-ink">Forgot password?</Link></>}
            {mode !== 'login' && <Link to="/login" className="font-medium hover:text-plum">Back to sign in</Link>}
          </div>
        </form>
      </main>
    </div>
  );
}

export function Wordmark({ className = '' }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 text-xl font-black tracking-[-0.04em] ${className}`} style={{ fontStretch: '112%' }}>
      <span aria-hidden className="grid size-6 place-items-center bg-plum text-body text-white">b</span>
      brightloop
    </Link>
  );
}
