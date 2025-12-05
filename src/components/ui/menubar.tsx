"use client";

import * as React from "react";
import { CheckIcon, CircleIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * Menubar component using daisyUI menu
 * CSS-only approach, no portals
 */

function Menubar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="menubar"
      className={cn(
        "menu menu-horizontal bg-base-100 rounded-box flex h-9 items-center gap-1 border p-1 shadow-xs",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function MenubarMenu({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="menubar-menu" className="dropdown dropdown-hover" {...props}>
      {children}
    </div>
  );
}

function MenubarGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="menubar-group" {...props}>{children}</div>;
}

function MenubarPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MenubarRadioGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="menubar-radio-group" role="group" {...props}>{children}</div>;
}

function MenubarTrigger({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="menubar-trigger"
      tabIndex={0}
      role="button"
      className={cn(
        "flex items-center rounded-sm px-2 py-1 text-sm font-medium cursor-pointer hover:bg-base-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function MenubarContent({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-slot="menubar-content"
      tabIndex={0}
      className={cn(
        "dropdown-content z-50 menu bg-base-100 rounded-box min-w-[12rem] p-1 shadow-lg border",
        className
      )}
      {...props}
    >
      {children}
    </ul>
  );
}

interface MenubarItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
}

function MenubarItem({ className, inset, variant = "default", children, ...props }: MenubarItemProps) {
  return (
    <li
      data-slot="menubar-item"
      className={cn(variant === "destructive" && "text-error", className)}
      {...props}
    >
      <a className={cn(inset && "pl-8")}>{children}</a>
    </li>
  );
}

interface MenubarCheckboxItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  checked?: boolean;
}

function MenubarCheckboxItem({ className, checked, children, ...props }: MenubarCheckboxItemProps) {
  return (
    <li data-slot="menubar-checkbox-item" className={className} {...props}>
      <a className="flex items-center gap-2">
        <span className="w-4">{checked && <CheckIcon className="size-4" />}</span>
        {children}
      </a>
    </li>
  );
}

interface MenubarRadioItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  checked?: boolean;
}

function MenubarRadioItem({ className, checked, children, ...props }: MenubarRadioItemProps) {
  return (
    <li data-slot="menubar-radio-item" className={className} {...props}>
      <a className="flex items-center gap-2">
        <span className="w-4">{checked && <CircleIcon className="size-2 fill-current" />}</span>
        {children}
      </a>
    </li>
  );
}

interface MenubarLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

function MenubarLabel({ className, inset, ...props }: MenubarLabelProps) {
  return (
    <div
      data-slot="menubar-label"
      className={cn("px-2 py-1.5 text-sm font-medium", inset && "pl-8", className)}
      {...props}
    />
  );
}

function MenubarSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="menubar-separator" className={cn("divider my-1", className)} {...props} />;
}

function MenubarShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn("ml-auto text-xs text-base-content/50", className)}
      {...props}
    />
  );
}

function MenubarSub({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li data-slot="menubar-sub" {...props}>
      <details>
        {children}
      </details>
    </li>
  );
}

interface MenubarSubTriggerProps extends React.HTMLAttributes<HTMLElement> {
  inset?: boolean;
}

function MenubarSubTrigger({ className, inset, children, ...props }: MenubarSubTriggerProps) {
  return (
    <summary
      data-slot="menubar-sub-trigger"
      className={cn("flex items-center", inset && "pl-8", className)}
      {...props}
    >
      {children}
    </summary>
  );
}

function MenubarSubContent({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-slot="menubar-sub-content"
      className={cn("menu bg-base-100 rounded-box z-50 min-w-[8rem] shadow-lg", className)}
      {...props}
    >
      {children}
    </ul>
  );
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
