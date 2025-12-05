"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Separator component using daisyUI divider
 */
interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <div
      data-slot="separator"
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "divider",
        orientation === "vertical" ? "divider-horizontal" : "",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
