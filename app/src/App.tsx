import { AppShell } from './components/AppShell';
import { AppProvider, useAppContext } from './powerplatform/context/AppContext';
import { ScrActivityLog } from './screens/ScrActivityLog';
import { ScrAssignments } from './screens/ScrAssignments';
import { ScrCompetency } from './screens/ScrCompetency';
import { ScrDepartments } from './screens/ScrDepartments';
import { ScrHome } from './screens/ScrHome';
import { ScrInspectorDetail } from './screens/ScrInspectorDetail';
import { ScrInspectors } from './screens/ScrInspectors';
import { ScrJobDetail } from './screens/ScrJobDetail';
import { ScrJobs } from './screens/ScrJobs';
import { ScrLeave } from './screens/ScrLeave';
import { ScrPlanner } from './screens/ScrPlanner';
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
    case 'scrCompetency': return <ScrCompetency />;
    case 'scrActivityLog': return <ScrActivityLog />;
    case 'scrLeave': return <ScrLeave />;
    case 'scrHome':
    default: return <ScrHome />;
  }
}

function App() {
  return (
    <AppProvider>
      <AppShell>
        <ScreenRouter />
      </AppShell>
    </AppProvider>
  );
}

export default App;
