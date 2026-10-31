import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './lib/api.js';
import Shell from './components/Shell.jsx';
import { Loading } from './components/Layout.jsx';
import AuthPage from './pages/Auth.jsx';
import Overview from './pages/Overview.jsx';
import Subscriptions from './pages/subscriptions/Subscriptions.jsx';
import Invoices from './pages/invoices/Invoices.jsx';
import Payments from './pages/Payments.jsx';
import Customers from './pages/Customers.jsx';
import Reports from './pages/Reports.jsx';
import Catalog from './pages/catalog/Catalog.jsx';
import Quotes from './pages/Quotes.jsx';
import Team from './pages/Team.jsx';
import PortalOverview from './pages/portal/PortalOverview.jsx';
import Plans from './pages/portal/Plans.jsx';

// Routes each role can reach; the server enforces the same rules on every API call.
function routesFor(role) {
  if (role === 'customer') return [['plans', Plans], ['subscriptions', Subscriptions], ['invoices', Invoices]];
  const staff = [['catalog', Catalog], ['quotes', Quotes], ['subscriptions', Subscriptions], ['invoices', Invoices], ['payments', Payments], ['reports', Reports], ['customers', Customers]];
  return role === 'admin' ? [...staff, ['team', Team]] : staff;
}
//export default function app()
export default function App() {
  const session = useSession();
  if (session.isLoading) return <div className="px-10"><Loading label="Opening Brightloop" /></div>;
  const user = session.data?.user;

  return (
    <Routes>
      <Route path="/reset-password" element={<AuthPage mode="reset" />} />
      {!user ? (
        <>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <Route element={<Shell user={user} />}>
          <Route index element={user.role === 'customer' ? <PortalOverview /> : <Overview />} />
          {routesFor(user.role).map(([path, Page]) => <Route key={path} path={path} element={<Page />} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
