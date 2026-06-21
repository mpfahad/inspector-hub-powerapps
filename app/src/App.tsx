import { AppShell } from './components/AppShell';
import { AppProvider, useAppContext } from './powerplatform/context/AppContext';
import { ScrActivityLog } from './screens/ScrActivityLog';
import { ScrAdmin } from './screens/ScrAdmin';
import { ScrAssignments } from './screens/ScrAssignments';
import { ScrCompetency } from './screens/ScrCompetency';
import { ScrDashboards } from './screens/ScrDashboards';
import { ScrDepartments } from './screens/ScrDepartments';
import { ScrHome } from './screens/ScrHome';
import { ScrInspectorDetail } from './screens/ScrInspectorDetail';
import { ScrInspectors } from './screens/ScrInspectors';
import { ScrJobDetail } from './screens/ScrJobDetail';
import { ScrJobs } from './screens/ScrJobs';
import { ScrLeave } from './screens/ScrLeave';
import { ScrLogin } from './screens/ScrLogin';
import { ScrPlanner } from './screens/ScrPlanner';
import { ScrQualifications } from './screens/ScrQualifications';
import { ScrReports } from './screens/ScrReports';
import { ScrWorkflows } from './screens/ScrWorkflows';
import './App.css';

function ScreenRouter() {
  const { currentScreen } = useAppContext();

  switch (currentScreen) {
    case 'scrDepartments': return <ScrDepartments />;
    case 'scrJobs': return <ScrJobs />;
    case 'scrJobDetail': return <ScrJobDetail />;
    case 'scrAssignments': return <ScrAssignments />;
    case 'scrInspectors': return <ScrInspectors />;
    case 'scrInspectorDetail': return <ScrInspectorDetail />;
    case 'scrPlanner': return <ScrPlanner />;
    case 'scrQualifications': return <ScrQualifications />;
    case 'scrCompetency': return <ScrCompetency />;
    case 'scrActivityLog': return <ScrActivityLog />;
    case 'scrLeave': return <ScrLeave />;
    case 'scrDashboards': return <ScrDashboards />;
    case 'scrReports': return <ScrReports />;
    case 'scrWorkflows': return <ScrWorkflows />;
    case 'scrAdmin': return <ScrAdmin />;
    case 'scrHome':
    default: return <ScrHome />;
  }
}

function AppContent() {
  const { vars } = useAppContext();
  if (!vars.varIsAuthenticated) {
    return <ScrLogin />;
  }
  return (
    <AppShell>
      <ScreenRouter />
    </AppShell>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
