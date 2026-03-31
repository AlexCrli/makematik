"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  organizationId: string | null;
  companies: { id: string; name: string }[];
}

export const AppContext = createContext<AppContextValue>({
  organizationId: null,
  companies: [],
});

export function useAppContext() {
  return useContext(AppContext);
}
