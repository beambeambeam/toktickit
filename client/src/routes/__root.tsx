import { createRootRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const { TanStackRouterDevtools: Devtools } =
        await import("@tanstack/react-router-devtools");

      return { default: Devtools };
    })
  : null;

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Suspense fallback={null}>
        {TanStackRouterDevtools ? <TanStackRouterDevtools /> : null}
      </Suspense>
    </>
  ),
});
