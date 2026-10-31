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
          <Route index element={<Overview />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="invoices" element={<Invoices />} />
          {user.role !== 'customer' && <Route path="payments" element={<Payments />} />}
          {user.role !== 'customer' && <Route path="customers" element={<Customers />} />}
          {user.role !== 'customer' && <Route path="reports" element={<Reports />} />}
          {user.role !== 'customer' && <Route path="catalog" element={<Catalog />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
