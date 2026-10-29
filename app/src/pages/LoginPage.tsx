import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_OFFLINE_MESSAGE, checkApiHealth } from '../lib/api';

const isDev = import.meta.env.DEV;

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(isDev ? 'coordinator@irppms.local' : '');
  const [password, setPassword] = useState(isDev ? 'password123' : '');
  const [error, setError] = useState('');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkApiHealth().then(setApiOnline);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-navy text-white p-12">
        <div>
          <div className="text-2xl font-bold">IRPPMS</div>
          <div className="text-xs opacity-70 uppercase tracking-wider">Inspector Resource Planning & Productivity Management System</div>
        </div>
        <p className="max-w-md text-lg opacity-90">Local deployment — your data stays on your infrastructure.</p>
        <div className="text-xs opacity-60">Docker · SQLite · No third-party services</div>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-navy">Sign in</h1>
          {apiOnline === false && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">API server is not running</p>
              <p className="mt-1 text-xs">{API_OFFLINE_MESSAGE}</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="text-xs font-medium text-slate-600">Email</label>
            <input
              className="input mt-1"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              className="input mt-1"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full">Sign in</button>
        </form>
      </div>
    </div>
  );
}
