import { COOKIE_NAME } from "@shared/const";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      console.warn("tRPC logout warning:", error);
      // Attempt REST logout fallback
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch {}
    } finally {
      // Clear all session, storage, caches, and offline queue
      try {
        sessionStorage.removeItem("manus-cookie");
        sessionStorage.clear();
        localStorage.removeItem("manus-cookie");
        localStorage.removeItem("manus-runtime-user-info");
        localStorage.removeItem("dosje-selected-role");
        localStorage.removeItem("dosje-user-data");
        document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
        if ("caches" in window) {
          caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
        }
        if ("indexedDB" in window) {
          try { window.indexedDB.deleteDatabase("securesight-offline-db"); } catch {}
        }
      } catch {}
      utils.auth.me.setData(undefined, null);
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    // Navigate at this moment only.
    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      window.location.href = "/login";
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
