import { CircleIcon, Flag01Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/class-names";

interface StatusBadgeProps {
  kind: "priority" | "status";
  value: string;
}

export const StatusBadge = ({ kind, value }: StatusBadgeProps) => (
  <span className={cn("status-badge", `${kind}-badge`, value.toLowerCase())}>
    <Icon icon={kind === "status" ? CircleIcon : Flag01Icon} /> {value}
  </span>
);
