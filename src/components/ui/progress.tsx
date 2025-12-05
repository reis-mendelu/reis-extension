"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Progress component using daisyUI progress
 */
interface ProgressProps extends React.HTMLAttributes<HTMLProgressElement> {
  value?: number;
  max?: number;
  variant?: "primary" | "secondary" | "accent" | "info" | "success" | "warning" | "error";
}

function Progress({
  className,
  value = 0,
  max = 100,
  variant = "primary",
  ...props
}: ProgressProps) {
  const variantClasses = {
    primary: "progress-primary",
    secondary: "progress-secondary",
    accent: "progress-accent",
    info: "progress-info",
    success: "progress-success",
    warning: "progress-warning",
    error: "progress-error",
  };

  return (
    <progress
      data-slot="progress"
      className={cn("progress", variantClasses[variant], className)}
      value={value}
      max={max}
      {...props}
    />
  );
}

export { Progress };
