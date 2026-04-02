"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  organizationId: string | null;
  companies: { id: string; name: string }[];
  role: string | null;
}

export const AppContext = createContext<AppContextValue>({
  organizationId: null,
  companies: [],
  role: null,
});

export function useAppContext() {
  return useContext(AppContext);
}
