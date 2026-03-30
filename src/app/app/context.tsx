"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  organizationId: string | null;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string) => void;
  companies: { id: string; name: string }[];
}

export const AppContext = createContext<AppContextValue>({
  organizationId: null,
  selectedCompanyId: null,
  setSelectedCompanyId: () => {},
  companies: [],
});

export function useAppContext() {
  return useContext(AppContext);
}
