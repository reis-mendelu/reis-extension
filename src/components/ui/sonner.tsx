"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-base-100 group-[.toaster]:text-base-content group-[.toaster]:border group-[.toaster]:border-base-200 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-base-content/70",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-content",
          cancelButton:
            "group-[.toast]:bg-base-200 group-[.toast]:text-base-content",
          success: "group-[.toast]:border-success/20",
          error: "group-[.toast]:border-error/20",
          info: "group-[.toast]:border-info/20",
          warning: "group-[.toast]:border-warning/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
