import { createRootRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { RequesterProvider } from "@/context/requester";

const showRouterDevtools =
  import.meta.env.DEV && import.meta.env.VITE_SHOW_ROUTER_DEVTOOLS !== "false";

const TanStackRouterDevtools = showRouterDevtools
  ? lazy(async () => {
      const { TanStackRouterDevtools: Devtools } =
        await import("@tanstack/react-router-devtools");

      return { default: Devtools };
    })
  : null;

export const Route = createRootRoute({
  component: () => (
    <RequesterProvider>
      <Outlet />
      <Suspense fallback={null}>
        {TanStackRouterDevtools ? <TanStackRouterDevtools /> : null}
      </Suspense>
    </RequesterProvider>
  ),
});
