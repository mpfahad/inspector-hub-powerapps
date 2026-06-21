import { useState } from 'react';
import { BtnPrimary, TxtInput, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import type { UserRole } from '../powerplatform/types';

const ROLES: UserRole[] = ['Admin', 'Manager', 'Inspector'];

export function ScrLogin() {
  const { signIn } = useAppContext();
  const [email, setEmail] = useState('sarah.hollis@irppms.co');
  const [role, setRole] = useState<UserRole>('Manager');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, #0f4c5c 0%, #1a6b7a 100%)',
          color: '#fff',
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>IRPPMS</div>
          <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Inspector Platform</div>
        </div>
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8, marginBottom: 12 }}>ENTERPRISE EDITION</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.2, margin: '0 0 16px' }}>Plan, dispatch, and measure your inspection workforce.</h1>
          <p style={{ opacity: 0.85, lineHeight: 1.6 }}>
            Canvas equivalent: Azure AD / Microsoft 365 sign-in — no custom login screen in production.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>81</div><div style={{ fontSize: 11, opacity: 0.7 }}>Inspectors</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>14</div><div style={{ fontSize: 11, opacity: 0.7 }}>Open jobs</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>92%</div><div style={{ fontSize: 11, opacity: 0.7 }}>Acceptance</div></div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: theme.colors.background }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>Welcome back</h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: 24, fontSize: 14 }}>Sign in to your inspection workspace (demo).</p>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Work email</span>
            <TxtInput value={email} onChange={setEmail} placeholder="you@company.com" />
          </label>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Simulated role (Canvas: LookUp UserRoles)</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: `1px solid ${theme.colors.border}` }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <BtnPrimary
            onClick={() => signIn(email, role)}
            style={{ width: '100%', marginTop: 8 }}
          >
            Sign in → Navigate(scrHome)
          </BtnPrimary>

          <p style={{ fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 24 }}>
            Production: Office365Users.MyProfile() · User().Email
          </p>
        </div>
      </div>
    </div>
  );
}
