import * as React from "react";
import { cn } from "./utils";

/**
 * Textarea component using daisyUI textarea classes
 */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "bordered" | "ghost";
}

function Textarea({
  className,
  variant = "bordered",
  ...props
}: TextareaProps) {
  const variantClasses = {
    default: "",
    bordered: "textarea-bordered",
    ghost: "textarea-ghost",
  };

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "textarea w-full",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
