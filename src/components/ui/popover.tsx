"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Popover component using daisyUI dropdown
 * Works inside Shadow DOM without portals
 */

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Popover({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled
    ? (val: boolean) => onOpenChange?.(val)
    : (val: boolean) => {
      setUncontrolledOpen(val);
      onOpenChange?.(val);
    };

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div data-slot="popover" className="dropdown">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function PopoverTrigger({ className, children, asChild, onClick, ...props }: PopoverTriggerProps) {
  const context = React.useContext(PopoverContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    context?.setOpen(!context.open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      tabIndex: 0,
      "data-slot": "popover-trigger",
    });
  }

  return (
    <button
      type="button"
      data-slot="popover-trigger"
      tabIndex={0}
      className={cn("btn", className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function PopoverContent({
  className,
  align = "center",
  children,
  ...props
}: PopoverContentProps) {
  const context = React.useContext(PopoverContext);

  if (!context?.open) return null;

  return (
    <div
      data-slot="popover-content"
      className={cn(
        "dropdown-content z-50 bg-base-100 rounded-box p-4 shadow-lg border border-base-300 w-72",
        align === "end" && "dropdown-end",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function PopoverAnchor({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
