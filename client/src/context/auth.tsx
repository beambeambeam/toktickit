import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { PropsWithChildren } from "react";

import {
  changePassword as changePasswordRequest,
  getCurrentAuth,
  login as loginRequest,
  logout as logoutRequest,
} from "@/api/auth";
import type {
  AuthResponse,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
} from "@/api/auth";
import { AUTH_SESSION_LOST_EVENT, clearCsrfToken } from "@/api/client";
import { ApiRequestError } from "@/api/errors";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

interface AuthContextValue {
  auth: AuthResponse | null;
  authError: Error | null;
  changePassword: (input: ChangePasswordInput) => Promise<AuthResponse>;
  isLoading: boolean;
  isRefreshing: boolean;
  login: (input: LoginInput) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refetchAuth: () => Promise<unknown>;
  user: AuthUser | null;
}

const publicQueryNames = new Set([
  "auth",
  "categories",
  "health",
  "related-systems",
]);

const isPrivateQuery = (queryKey: readonly unknown[]): boolean => {
  const [firstKey] = queryKey;
  return typeof firstKey !== "string" || !publicQueryNames.has(firstKey);
};

const clearPrivateClientState = (
  queryClient: ReturnType<typeof useQueryClient>
) => {
  void queryClient.cancelQueries({
    predicate: (query) => isPrivateQuery(query.queryKey),
  });
  queryClient.removeQueries({
    predicate: (query) => isPrivateQuery(query.queryKey),
  });
};

const loadCurrentAuth = async ({
  signal,
}: {
  signal: AbortSignal;
}): Promise<AuthResponse | null> => {
  try {
    return await getCurrentAuth(signal);
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.status === 401) {
      clearCsrfToken();
      return null;
    }

    throw error;
  }
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const authQuery = useQuery<AuthResponse | null>({
    queryFn: loadCurrentAuth,
    queryKey: AUTH_QUERY_KEY,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 0,
  });
  const previousUserIdRef = useRef<number | null>(null);
  const authenticatedUserId =
    authQuery.isSuccess && authQuery.data !== null
      ? authQuery.data.user.id
      : null;

  useEffect(() => {
    if (
      previousUserIdRef.current !== null &&
      previousUserIdRef.current !== authenticatedUserId
    ) {
      clearPrivateClientState(queryClient);
    }

    previousUserIdRef.current = authenticatedUserId;
  }, [authenticatedUserId, queryClient]);

  const clearSession = useCallback(() => {
    clearCsrfToken();
    clearPrivateClientState(queryClient);
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
  }, [queryClient]);

  useEffect(() => {
    const handleSessionLoss = () => {
      clearSession();
    };

    window.addEventListener(AUTH_SESSION_LOST_EVENT, handleSessionLoss);
    return () => {
      window.removeEventListener(AUTH_SESSION_LOST_EVENT, handleSessionLoss);
    };
  }, [clearSession]);

  const replaceSession = useCallback(
    (nextAuth: AuthResponse): AuthResponse => {
      clearPrivateClientState(queryClient);
      queryClient.setQueryData(AUTH_QUERY_KEY, nextAuth);
      return nextAuth;
    },
    [queryClient]
  );

  const login = useCallback(
    async (input: LoginInput): Promise<AuthResponse> =>
      replaceSession(await loginRequest(input)),
    [replaceSession]
  );

  const changePassword = useCallback(
    async (input: ChangePasswordInput): Promise<AuthResponse> =>
      replaceSession(await changePasswordRequest(input)),
    [replaceSession]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
      clearSession();
    } catch (error: unknown) {
      if (!(error instanceof ApiRequestError && error.status === 403)) {
        clearSession();
      }
      throw error;
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth: authQuery.isSuccess ? (authQuery.data ?? null) : null,
      authError: authQuery.isError ? authQuery.error : null,
      changePassword,
      isLoading: authQuery.isPending,
      isRefreshing: authQuery.isFetching && !authQuery.isPending,
      login,
      logout,
      refetchAuth: async () => await authQuery.refetch(),
      user: authQuery.isSuccess ? (authQuery.data?.user ?? null) : null,
    }),
    [authQuery, changePassword, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
