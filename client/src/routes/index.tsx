import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthLoading, RequesterAccessDenied } from "@/components/app-shell";
import { useAuth } from "@/context/auth";

const LandingPage = () => {
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
    }
  }, [isLoading, navigate, user]);

  if (user !== null && user.role !== "Requester" && !user.mustChangePassword) {
    return <RequesterAccessDenied />;
  }

  return <AuthLoading />;
};

export const Route = createFileRoute("/")({
  component: LandingPage,
});
