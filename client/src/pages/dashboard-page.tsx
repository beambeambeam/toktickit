import { useAuth } from "@/context/auth";
import { RequesterDashboardPage } from "@/pages/requester-dashboard-page";
import { StaffDashboardPage } from "@/pages/staff-dashboard-page";

export const DashboardPage = () => {
  const { user } = useAuth();

  if (user?.role === "IT Staff" || user?.role === "Administrator") {
    return <StaffDashboardPage />;
  }

  return <RequesterDashboardPage />;
};
