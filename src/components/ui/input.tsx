import * as React from "react";
import { cn } from "./utils";

/**
 * Input component using daisyUI input classes
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "bordered" | "ghost";
  inputSize?: "xs" | "sm" | "md" | "lg";
}

const variantClasses = {
  default: "",
  bordered: "input-bordered",
  ghost: "input-ghost",
} as const;

const sizeClasses = {
  xs: "input-xs",
  sm: "input-sm",
  md: "input-md",
  lg: "input-lg",
} as const;

function Input({
  className,
  type,
  variant = "bordered",
  inputSize,
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input w-full",
        variantClasses[variant],
        inputSize && sizeClasses[inputSize],
        className,
      )}
      {...props}
    />
  );
}

export { Input };
