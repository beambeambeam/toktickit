import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

import { cn } from "@/lib/class-names";

interface IconProps {
  className?: string;
  icon: IconSvgElement;
}

// Decorative icons inherit their label from surrounding text or the control.
export const Icon = ({ className, icon }: IconProps) => (
  <HugeiconsIcon
    aria-hidden="true"
    className={cn("app-icon", className)}
    focusable="false"
    icon={icon}
    size="1em"
    strokeWidth={1.75}
  />
);
