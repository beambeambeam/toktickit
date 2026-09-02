import { cn } from "@/lib/class-names";

interface StatusBadgeProps {
  kind: "priority" | "status";
  value: string;
}

export const StatusBadge = ({ kind, value }: StatusBadgeProps) => (
  <span className={cn("status-badge", `${kind}-badge`, value.toLowerCase())}>
    <span aria-hidden="true">{kind === "status" ? "●" : "◆"}</span> {value}
  </span>
);
