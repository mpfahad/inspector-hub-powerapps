import { useAppContext } from '../powerplatform/context/AppContext';
import { theme } from '../components/controls';
import type { ScreenName } from '../powerplatform/types';

type NavGroup = { label: string; items: { screen: ScreenName; label: string; icon: string }[] };

const navGroups: NavGroup[] = [
  {
    label: 'Planning',
    items: [
      { screen: 'scrHome', label: 'Dashboard', icon: '📊' },
      { screen: 'scrDepartments', label: 'Departments', icon: '🏢' },
      { screen: 'scrPlanner', label: 'Resource Planner', icon: '📅' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { screen: 'scrJobs', label: 'Jobs', icon: '📋' },
      { screen: 'scrAssignments', label: 'Assignments', icon: '✅' },
      { screen: 'scrActivityLog', label: 'Activity Logs', icon: '📝' },
    ],
  },
  {
    label: 'People',
    items: [
      { screen: 'scrInspectors', label: 'Inspectors', icon: '👷' },
      { screen: 'scrQualifications', label: 'Qualifications', icon: '📜' },
      { screen: 'scrCompetency', label: 'Competency Matrix', icon: '🎓' },
      { screen: 'scrLeave', label: 'Leave', icon: '🏖️' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { screen: 'scrDashboards', label: 'Executive Dashboards', icon: '📈' },
      { screen: 'scrReports', label: 'Reports', icon: '📑' },
      { screen: 'scrWorkflows', label: 'Workflows', icon: '⚡' },
      { screen: 'scrAdmin', label: 'Administration', icon: '⚙️' },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { navigate, currentScreen, vars, signOut } = useAppContext();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <nav
        style={{
          width: 230,
          background: theme.colors.surface,
          borderRight: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: theme.spacing.sm,
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: theme.spacing.md, borderBottom: `1px solid ${theme.colors.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f4c5c' }}>IRPPMS</div>
          <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
            Inspector Platform · PowerApps mockup
          </div>
          <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 6 }}>
            {vars.varUserRole} · {vars.varCurrentUserEmail}
          </div>
        </div>
        {navGroups.map((group) => (
          <div key={group.label} style={{ marginTop: theme.spacing.sm }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: theme.colors.textSecondary, padding: '8px 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {group.label}
            </div>
            {group.items.map((item) => (
              <button
                key={item.screen}
                type="button"
                onClick={() => navigate(item.screen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  margin: '2px 0',
                  border: 'none',
                  borderRadius: theme.radius,
                  background: currentScreen === item.screen ? theme.colors.navActive : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 14,
                  color: theme.colors.text,
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: theme.spacing.sm }}>
          <button
            type="button"
            onClick={signOut}
            style={{
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              color: theme.colors.textSecondary,
            }}
          >
            Sign out
          </button>
          <div style={{ fontSize: 10, color: theme.colors.textSecondary, padding: '4px 14px' }}>
            github.com/mpfahad/inspector-hub-powerapps
          </div>
        </div>
      </nav>
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { back } = useAppContext();
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        background: theme.colors.surface,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      {onBack !== undefined && (
        <button type="button" onClick={onBack ?? back} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>
          ←
        </button>
      )}
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
    </header>
  );
}
