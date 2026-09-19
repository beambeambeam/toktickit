import {
  CircleIcon,
  Flag01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/class-names";

interface StatusBadgeProps {
  kind: "owner" | "priority" | "status";
  value: string;
}

const getBadgeIcon = (kind: StatusBadgeProps["kind"]) => {
  if (kind === "status") {
    return CircleIcon;
  }

  if (kind === "priority") {
    return Flag01Icon;
  }

  return UserGroupIcon;
};

export const StatusBadge = ({ kind, value }: StatusBadgeProps) => (
  <span
    className={cn(
      "status-badge",
      `${kind}-badge`,
      kind === "owner" ? undefined : value.toLowerCase()
    )}
  >
    <Icon icon={getBadgeIcon(kind)} /> {value}
  </span>
);
