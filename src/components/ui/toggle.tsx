"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Toggle component - button that toggles on/off state
 */

const sizeClasses = {
  default: "h-9 px-2 min-w-9",
  sm: "h-8 px-1.5 min-w-8",
  lg: "h-10 px-2.5 min-w-10",
} as const;

const variantClasses = {
  default: "bg-transparent hover:bg-base-200",
  outline: "btn-outline",
} as const;

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
}

function Toggle({
  className,
  pressed: controlledPressed,
  defaultPressed = false,
  onPressedChange,
  variant = "default",
  size = "default",
  children,
  ...props
}: ToggleProps) {
  const [uncontrolledPressed, setUncontrolledPressed] = React.useState(defaultPressed);

  const isControlled = controlledPressed !== undefined;
  const pressed = isControlled ? controlledPressed : uncontrolledPressed;

  const handleClick = () => {
    const newPressed = !pressed;
    if (!isControlled) {
      setUncontrolledPressed(newPressed);
    }
    onPressedChange?.(newPressed);
  };

  return (
    <button
      type="button"
      data-slot="toggle"
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed}
      onClick={handleClick}
      className={cn(
        "btn inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
        variantClasses[variant],
        sizeClasses[size],
        pressed && "btn-active bg-accent text-accent-content",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Toggle };
