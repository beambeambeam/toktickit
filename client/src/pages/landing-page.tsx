import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthLoading } from "@/components/app-shell";
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

    if (user.role === "Requester") {
      void navigate({ to: "/tickets" });
    } else if (user.role === "IT Staff") {
      void navigate({ to: "/staff/tickets" });
    } else if (user.role === "Administrator") {
      void navigate({ to: "/users" });
    }
  }, [isLoading, navigate, user]);

  return <AuthLoading />;
};
