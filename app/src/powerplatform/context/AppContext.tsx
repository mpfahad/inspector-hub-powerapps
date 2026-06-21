import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AppVariables, ScreenName, UserRole } from '../types';

interface AppContextValue {
  vars: AppVariables;
  setVar: <K extends keyof AppVariables>(key: K, value: AppVariables[K]) => void;
  updateContext: (patch: Partial<AppVariables>) => void;
  navigate: (screen: ScreenName) => void;
  currentScreen: ScreenName;
  back: () => void;
  /** PowerFx: Set(varIsAuthenticated, true); Navigate(scrHome) — Canvas uses Azure AD */
  signIn: (email: string, role?: UserRole) => void;
  signOut: () => void;
}

const defaultVars: AppVariables = {
  varIsAuthenticated: false,
  varCurrentUserEmail: '',
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

  const signIn = useCallback((email: string, role: UserRole = 'Manager') => {
    setVars((prev) => ({
      ...prev,
      varIsAuthenticated: true,
      varCurrentUserEmail: email,
      varUserRole: role,
    }));
    setCurrentScreen('scrHome');
    setScreenStack(['scrHome']);
  }, []);

  const signOut = useCallback(() => {
    setVars({ ...defaultVars });
    setCurrentScreen('scrLogin');
    setScreenStack(['scrLogin']);
  }, []);

  const value = useMemo(
    () => ({ vars, setVar, updateContext, navigate, currentScreen, back, signIn, signOut }),
    [vars, setVar, updateContext, navigate, currentScreen, back, signIn, signOut]
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
