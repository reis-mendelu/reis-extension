"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Switch component using daisyUI toggle
 * Same API as Radix Switch for backward compatibility
 */
interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <input
      type="checkbox"
      data-slot="switch"
      className={cn(
        "toggle toggle-primary",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  );
}

export { Switch };
