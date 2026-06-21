import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AppVariables, ScreenName, UserRole } from '../types';

interface AppContextValue {
  vars: AppVariables;
  /** PowerFx: Set(varSelectedJobId, galJobs.Selected.ID) */
  setVar: <K extends keyof AppVariables>(key: K, value: AppVariables[K]) => void;
  /** PowerFx: UpdateContext({ varFilterJobStatus: "Scheduled", varGalleryPage: 0 }) */
  updateContext: (patch: Partial<AppVariables>) => void;
  /** PowerFx: Navigate(scrJobDetail, ScreenTransition.Fade) */
  navigate: (screen: ScreenName) => void;
  currentScreen: ScreenName;
  /** PowerFx: Back() */
  back: () => void;
}

const defaultVars: AppVariables = {
  varCurrentUserEmail: 'manager@company.com',
  varUserRole: 'Manager',
  varSelectedJobId: null,
  varSelectedInspectorId: null,
  varFilterJobStatus: 'All',
  varFilterInspectorStatus: 'All',
  varDataRowLimit: 500,
  varGalleryPage: 0,
  varFormMode: 'View',
  varIsLoading: false,
  varStatusMessage: '',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [vars, setVars] = useState<AppVariables>(defaultVars);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('scrHome');
  const [screenStack, setScreenStack] = useState<ScreenName[]>(['scrHome']);

  const setVar = useCallback(<K extends keyof AppVariables>(key: K, value: AppVariables[K]) => {
    setVars((prev: AppVariables) => ({ ...prev, [key]: value }));
  }, []);

  const updateContext = useCallback((patch: Partial<AppVariables>) => {
    setVars((prev: AppVariables) => ({ ...prev, ...patch }));
  }, []);

  const navigate = useCallback((screen: ScreenName) => {
    setCurrentScreen(screen);
    setScreenStack((prev) => [...prev, screen]);
  }, []);

  const back = useCallback(() => {
    if (screenStack.length <= 1) return;
    const next = screenStack.slice(0, -1);
    setScreenStack(next);
    setCurrentScreen(next[next.length - 1]);
  }, [screenStack]);

  const value = useMemo(
    () => ({ vars, setVar, updateContext, navigate, currentScreen, back }),
    [vars, setVar, updateContext, navigate, currentScreen, back]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function useRoleGuard(allowed: UserRole[]): boolean {
  const { vars } = useAppContext();
  return allowed.includes(vars.varUserRole);
}
