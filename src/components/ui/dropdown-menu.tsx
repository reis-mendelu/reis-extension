"use client";

import * as React from "react";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * DropdownMenu component using daisyUI
 * CSS-only dropdown - no React Portals, works inside Shadow DOM
 */

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// function useDropdownContext() {
//   const context = React.useContext(DropdownContext);
//   if (!context) {
//     throw new Error("DropdownMenu components must be used within a DropdownMenu");
//   }
//   return context;
// }


interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => { })) : setUncontrolledOpen;

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="dropdown" data-slot="dropdown-menu">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>; // No portal needed with daisyUI
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function DropdownMenuTrigger({
  className,
  asChild,
  children,
  ...props
}: DropdownMenuTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      tabIndex: 0,
      role: "button",
      className: cn((children as React.ReactElement<any>).props.className, className),
    });
  }

  return (
    <button
      tabIndex={0}
      type="button"
      role="button"
      data-slot="dropdown-menu-trigger"
      className={cn("btn", className)}
      {...props}
    >
      {children}
    </button>
  );
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLUListElement> {
  align?: "start" | "end" | "center";
  sideOffset?: number;
}

function DropdownMenuContent({
  className,
  align = "start",
  children,
  ...props
}: DropdownMenuContentProps) {
  const alignClass = align === "end" ? "dropdown-end" : "";

  return (
    <ul
      tabIndex={0}
      data-slot="dropdown-menu-content"
      className={cn(
        "dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-lg border border-base-300",
        alignClass,
        className
      )}
      {...props}
    >
      {children}
    </ul>
  );
}

function DropdownMenuGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="dropdown-menu-group" className={className} {...props}>
      {children}
    </div>
  );
}

interface DropdownMenuItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onSelect?: () => void;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  disabled,
  onSelect,
  children,
  onClick,
  ...props
}: DropdownMenuItemProps) {
  const handleClick = (e: React.MouseEvent<HTMLLIElement>) => {
    if (disabled) return;
    onClick?.(e);
    onSelect?.();
    // Close dropdown by blurring
    (e.currentTarget.closest('.dropdown') as HTMLElement)?.blur();
  };

  return (
    <li
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      onClick={handleClick}
      {...props}
    >
      <a
        className={cn(
          "flex items-center gap-2",
          variant === "destructive" && "text-error",
          disabled && "opacity-50 pointer-events-none",
          inset && "pl-8",
          className
        )}
      >
        {children}
      </a>
    </li>
  );
}

interface DropdownMenuCheckboxItemProps extends Omit<DropdownMenuItemProps, 'children'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  children: React.ReactNode;
}

function DropdownMenuCheckboxItem({
  className,
  checked,
  onCheckedChange,
  children,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <li data-slot="dropdown-menu-checkbox-item" {...props}>
      <a
        className={cn("flex items-center gap-2", className)}
        onClick={() => onCheckedChange?.(!checked)}
      >
        <span className="w-4 h-4 flex items-center justify-center">
          {checked && <CheckIcon className="w-4 h-4" />}
        </span>
        {children}
      </a>
    </li>
  );
}

interface DropdownMenuRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
} | null>(null);

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: DropdownMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div data-slot="dropdown-menu-radio-group" {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface DropdownMenuRadioItemProps extends Omit<DropdownMenuItemProps, 'children'> {
  value: string;
  children: React.ReactNode;
}

function DropdownMenuRadioItem({
  className,
  value,
  children,
  ...props
}: DropdownMenuRadioItemProps) {
  const context = React.useContext(RadioGroupContext);
  const isSelected = context?.value === value;

  return (
    <li
      data-slot="dropdown-menu-radio-item"
      onClick={() => context?.onValueChange?.(value)}
      {...props}
    >
      <a className={cn("flex items-center gap-2", className)}>
        <span className="w-4 h-4 flex items-center justify-center">
          {isSelected && <CircleIcon className="w-2 h-2 fill-current" />}
        </span>
        {children}
      </a>
    </li>
  );
}

interface DropdownMenuLabelProps extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
}

function DropdownMenuLabel({
  className,
  inset,
  children,
  ...props
}: DropdownMenuLabelProps) {
  return (
    <li
      data-slot="dropdown-menu-label"
      className={cn("menu-title", inset && "pl-8", className)}
      {...props}
    >
      {children}
    </li>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("divider my-1", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto text-xs opacity-60", className)}
      {...props}
    />
  );
}

// Sub-menus are not directly supported by daisyUI dropdown
// These are placeholder implementations
function DropdownMenuSub({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

interface DropdownMenuSubTriggerProps extends DropdownMenuItemProps {
  inset?: boolean;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <li data-slot="dropdown-menu-sub-trigger" {...props}>
      <a className={cn("flex items-center justify-between", inset && "pl-8", className)}>
        {children}
        <ChevronRightIcon className="w-4 h-4 ml-auto" />
      </a>
    </li>
  );
}

function DropdownMenuSubContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "menu bg-base-100 rounded-box p-2 shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </ul>
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
