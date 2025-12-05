"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Slider component using daisyUI range
 */
interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'defaultValue'> {
  defaultValue?: number[];
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  orientation?: "horizontal" | "vertical";
}

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  orientation = "horizontal",
  ...props
}: SliderProps) {
  // For simplicity, we handle single value sliders
  // daisyUI range input doesn't support multiple thumbs natively
  const currentValue = value?.[0] ?? defaultValue?.[0] ?? min;

  return (
    <input
      type="range"
      data-slot="slider"
      min={min}
      max={max}
      step={step}
      value={currentValue}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      className={cn(
        "range range-primary",
        orientation === "vertical" && "orient-vertical",
        className
      )}
      {...props}
    />
  );
}

export { Slider };
