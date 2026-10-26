import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthLoading, homeRouteForRole } from "@/components/app-shell";
import { useAuth } from "@/context/auth";

export const LandingPage = () => {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (user === null) {
      void navigate({ to: "/login" });
      return;
    }

    if (user.mustChangePassword) {
      void navigate({ to: "/change-password" });
      return;
    }

    void navigate({ to: homeRouteForRole() });
  }, [isLoading, navigate, user]);

  return <AuthLoading />;
};
