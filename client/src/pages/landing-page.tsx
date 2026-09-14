import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell, AuthLoading } from "@/components/app-shell";
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
    } else if (user.role === "Administrator") {
      void navigate({ to: "/users" });
    }
  }, [isLoading, navigate, user]);

  if (!isLoading && user?.role === "IT Staff" && !user.mustChangePassword) {
    return (
      <AppShell
        allowedRoles={["IT Staff"]}
        eyebrow="IT Staff"
        title="My Account"
      >
        <section
          aria-labelledby="account-details-heading"
          className="surface-card form-section"
        >
          <h2 id="account-details-heading">Account details</h2>
          <dl>
            <dt>Name</dt>
            <dd>{user.displayName}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>{user.role}</dd>
            <dt>Status</dt>
            <dd>{user.isActive ? "Active" : "Inactive"}</dd>
          </dl>
          <p>
            Use Change Password to manage your credentials, or Log out to end
            your session.
          </p>
        </section>
      </AppShell>
    );
  }

  return <AuthLoading />;
};
