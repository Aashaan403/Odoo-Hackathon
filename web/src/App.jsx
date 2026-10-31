import { useSession } from './lib/api.js';

export default function App() {
  const session = useSession();
  return (
    <main className="grid min-h-svh place-items-center">
      <p className="text-mute">{session.isLoading ? 'Loading Brightloop' : `Signed in: ${session.data?.user?.email ?? 'no'}`}</p>
    </main>
  );
}
