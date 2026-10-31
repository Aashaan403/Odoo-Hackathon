import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './lib/api.js';
import Shell from './components/Shell.jsx';
import { Loading } from './components/Layout.jsx';
import AuthPage from './pages/Auth.jsx';

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
          <Route index element={<p className="text-mute">Overview is on its way.</p>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
