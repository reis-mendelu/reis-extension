"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * ToggleGroup component using daisyUI join
 */

interface ToggleGroupContextValue {
  type: "single" | "multiple";
  value: string | string[];
  onValueChange: (value: string | string[]) => void;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null);

interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}

function ToggleGroup({
  type = "single",
  value: controlledValue,
  defaultValue,
  onValueChange,
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: ToggleGroupProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | string[]>(
    defaultValue ?? (type === "multiple" ? [] : "")
  );

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const handleValueChange = isControlled
    ? (onValueChange ?? (() => { }))
    : (val: string | string[]) => {
      setUncontrolledValue(val);
      onValueChange?.(val);
    };

  return (
    <ToggleGroupContext.Provider value={{ type, value, onValueChange: handleValueChange, variant, size }}>
      <div
        data-slot="toggle-group"
        role="group"
        className={cn("join", className)}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function ToggleGroupItem({
  value,
  className,
  children,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext);

  const isPressed = context?.type === "multiple"
    ? (context.value as string[]).includes(value)
    : context?.value === value;

  const handleClick = () => {
    if (!context) return;

    if (context.type === "multiple") {
      const currentValue = context.value as string[];
      const newValue = isPressed
        ? currentValue.filter(v => v !== value)
        : [...currentValue, value];
      context.onValueChange(newValue);
    } else {
      context.onValueChange(isPressed ? "" : value);
    }
  };

  const sizeClasses = {
    default: "btn-md",
    sm: "btn-sm",
    lg: "btn-lg",
  };

  return (
    <button
      type="button"
      data-slot="toggle-group-item"
      data-state={isPressed ? "on" : "off"}
      aria-pressed={isPressed}
      onClick={handleClick}
      className={cn(
        "btn join-item",
        context?.variant === "outline" && "btn-outline",
        context?.size && sizeClasses[context.size],
        isPressed && "btn-active",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { ToggleGroup, ToggleGroupItem };
