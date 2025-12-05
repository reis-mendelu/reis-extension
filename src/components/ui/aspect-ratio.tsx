"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * AspectRatio component - pure CSS implementation
 * No Radix dependency
 */
interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  ratio?: number;
}

function AspectRatio({ ratio = 1, className, style, children, ...props }: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      className={cn("relative w-full", className)}
      style={{
        ...style,
        aspectRatio: ratio,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export { AspectRatio };
