import { createContext, useContext, useState, ReactNode } from 'react';

export interface BreadcrumbOverride {
  path: string;
  title: string;
}

interface BreadcrumbContextType {
  overrides: BreadcrumbOverride[];
  setOverride: (path: string, title: string) => void;
  removeOverride: (path: string) => void;
  getOverride: (path: string) => string | null;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<BreadcrumbOverride[]>([]);

  const setOverride = (path: string, title: string) => {
    setOverrides(prev => {
      const filtered = prev.filter(item => item.path !== path);
      return [...filtered, { path, title }];
    });
  };

  const removeOverride = (path: string) => {
    setOverrides(prev => prev.filter(item => item.path !== path));
  };

  const getOverride = (path: string): string | null => {
    const override = overrides.find(item => item.path === path);
    return override ? override.title : null;
  };

  return (
    <BreadcrumbContext.Provider value={{ overrides, setOverride, removeOverride, getOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }
  return context;
}
