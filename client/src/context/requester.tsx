import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import type { DevelopmentRequester } from "@/generated/hey-api/types.gen";

const STORAGE_KEY = "toktickit.development-requester";

interface RequesterContextValue {
  clearRequester: () => void;
  requester: DevelopmentRequester | null;
  selectRequester: (requester: DevelopmentRequester) => void;
}

const isDevelopmentRequester = (
  value: unknown
): value is DevelopmentRequester =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "number" &&
  "displayName" in value &&
  typeof value.displayName === "string" &&
  "email" in value &&
  typeof value.email === "string";

const readStoredRequester = (): DevelopmentRequester | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? "null"
    );
    return isDevelopmentRequester(value) ? value : null;
  } catch {
    return null;
  }
};

const storeRequester = (requester: DevelopmentRequester | null) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (requester === null) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(requester));
    }
  } catch {
    // Session storage is a convenience; in-memory context remains usable.
  }
};

const RequesterContext = createContext<RequesterContextValue | null>(null);

export const RequesterProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const [requester, setRequester] = useState<DevelopmentRequester | null>(
    readStoredRequester
  );

  const value = useMemo<RequesterContextValue>(
    () => ({
      clearRequester: () => {
        storeRequester(null);
        setRequester(null);
        queryClient.removeQueries({
          predicate: ({ queryKey }) =>
            queryKey[0] === "tickets" || queryKey[0] === "ticket",
        });
      },
      requester,
      selectRequester: (nextRequester) => {
        storeRequester(nextRequester);
        setRequester(nextRequester);
        queryClient.removeQueries({
          predicate: ({ queryKey }) =>
            queryKey[0] === "tickets" || queryKey[0] === "ticket",
        });
      },
    }),
    [queryClient, requester]
  );

  return (
    <RequesterContext.Provider value={value}>
      {children}
    </RequesterContext.Provider>
  );
};

export const useRequester = (): RequesterContextValue => {
  const context = useContext(RequesterContext);

  if (context === null) {
    throw new Error("useRequester must be used within RequesterProvider");
  }

  return context;
};
