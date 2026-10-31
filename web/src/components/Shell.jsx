import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { capitalize, initials, longToday } from '../lib/format.js';
import { Wordmark } from '../pages/Auth.jsx';

// The staff sidebar follows money through the business, so its numbers mark a real sequence.
const REVENUE_FLOW = [['/catalog', 'Catalog'], ['/quotes', 'Quotes'], ['/subscriptions', 'Subscriptions'], ['/invoices', 'Invoices'], ['/payments', 'Payments'], ['/reports', 'Reports']];
const PORTAL = [['/', 'Overview'], ['/plans', 'Plans'], ['/subscriptions', 'My subscriptions'], ['/invoices', 'My invoices']];

function NavItem({ to, label, number }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex h-9 items-center gap-3 px-3 text-body font-medium transition-colors ${isActive ? 'bg-plum-wash text-ink' : 'text-mute hover:text-ink'}`}>
      {({ isActive }) => (
        <>
          <span aria-hidden className={`w-5 shrink-0 text-caption tabular-nums ${isActive ? 'text-plum' : 'text-faint'}`}>{number}</span>
          {label}
        </>
      )}
    </NavLink>
  );
}

const GroupLabel = ({ children }) => <p className="mt-7 mb-1.5 px-3 text-caption text-faint">{children}</p>;

export default function Shell({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    queryClient.clear();
    queryClient.setQueryData(['session'], { user: null });
    navigate('/login', { replace: true });
  }

  const internal = user.role !== 'customer';

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center border-b border-line px-6"><Wordmark /></div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pt-5">
          {internal ? (
            <>
              <NavItem to="/" label="Overview" />
              <GroupLabel>From plan to revenue</GroupLabel>
              {REVENUE_FLOW.map(([to, label], index) => <NavItem key={to} to={to} label={label} number={String(index + 1).padStart(2, '0')} />)}
              <GroupLabel>People</GroupLabel>
              <NavItem to="/customers" label="Customers" />
              {user.role === 'admin' && <NavItem to="/team" label="Team and access" />}
            </>
          ) : PORTAL.map(([to, label]) => <NavItem key={to} to={to} label={label} />)}
        </nav>
        <div className="flex items-center gap-3 border-t border-line px-6 py-4">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center bg-ink text-caption font-bold text-white">{initials(user.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-body font-semibold">{user.name}</div>
            <div className="text-caption text-mute">{capitalize(user.role)}</div>
          </div>
          <button onClick={signOut} className="text-caption font-medium text-mute hover:text-alarm">Sign out</button>
        </div>
      </aside>
      {menuOpen && <div aria-hidden className="animate-veil fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="min-w-0">
        <div className="no-print sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-10">
            <button className="-ml-2 flex items-center gap-2 p-2 text-body font-medium lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden><path d="M0 1h16M0 6h16M0 11h16" stroke="currentColor" strokeWidth="1.5" /></svg>
              Menu
            </button>
            <span className="hidden text-body text-mute lg:inline">{longToday()}</span>
            <span className="text-caption text-mute">{internal ? (user.role === 'admin' ? 'Administrator' : 'Billing team') : 'Customer portal'}</span>
          </div>
        </div>
        <main className="mx-auto max-w-[1240px] px-5 pt-10 pb-24 sm:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
