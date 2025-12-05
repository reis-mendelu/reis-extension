import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * NavigationMenu component using daisyUI menu
 * CSS-only approach, works in Shadow DOM
 */

function NavigationMenu({
  className,
  children,
  viewport = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { viewport?: boolean }) {
  return (
    <nav
      data-slot="navigation-menu"
      data-viewport={viewport}
      className={cn(
        "relative flex max-w-max flex-1 items-center justify-center",
        className
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

function NavigationMenuList({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-slot="navigation-menu-list"
      className={cn("menu menu-horizontal flex-1 gap-1", className)}
      {...props}
    >
      {children}
    </ul>
  );
}

function NavigationMenuItem({ className, children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="navigation-menu-item"
      className={cn("relative dropdown dropdown-hover", className)}
      {...props}
    >
      {children}
    </li>
  );
}

const navigationMenuTriggerStyle = () =>
  "btn btn-ghost btn-sm inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-base-200";

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="navigation-menu-trigger"
      tabIndex={0}
      role="button"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon
        className="relative top-[1px] ml-1 size-3 transition duration-300 group-hover:rotate-180"
        aria-hidden="true"
      />
    </div>
  );
}

function NavigationMenuContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="navigation-menu-content"
      tabIndex={0}
      className={cn(
        "dropdown-content z-50 bg-base-100 rounded-box p-2 shadow-lg border min-w-[200px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function NavigationMenuViewport() {
  // Not needed for CSS-only implementation
  return null;
}

function NavigationMenuLink({
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      data-slot="navigation-menu-link"
      className={cn(
        "flex flex-col gap-1 rounded-sm p-2 text-sm transition-all hover:bg-base-200",
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

function NavigationMenuIndicator() {
  // Not needed for CSS-only implementation
  return null;
}

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
};
