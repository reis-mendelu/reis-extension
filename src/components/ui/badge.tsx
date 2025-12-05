import * as React from "react";
import { Slot } from "./slot";
import { cn } from "./utils";

/**
 * Badge component using daisyUI badge classes
 */

const variantClasses = {
  default: "badge-primary",
  secondary: "badge-secondary",
  destructive: "badge-error",
  outline: "badge-outline",
  success: "badge-success",
  warning: "badge-warning",
  info: "badge-info",
  neutral: "badge-neutral",
  ghost: "badge-ghost",
} as const;

const sizeClasses = {
  default: "",
  sm: "badge-sm",
  lg: "badge-lg",
} as const;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  asChild?: boolean;
}

function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(
        "badge",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
