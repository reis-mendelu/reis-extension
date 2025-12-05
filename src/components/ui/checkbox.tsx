"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Checkbox component using daisyUI checkbox
 * Same API as Radix Checkbox for backward compatibility
 */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "checkbox checkbox-primary checkbox-sm",
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

export { Checkbox };
