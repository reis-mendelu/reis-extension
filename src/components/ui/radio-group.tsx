"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * RadioGroup component using daisyUI radio
 */
interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
  name: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

function RadioGroup({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  name = "radio-group",
  className,
  children,
  ...props
}: RadioGroupProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const handleValueChange = isControlled
    ? (onValueChange ?? (() => { }))
    : (val: string) => {
      setUncontrolledValue(val);
      onValueChange?.(val);
    };

  return (
    <RadioGroupContext.Provider value={{ value, onValueChange: handleValueChange, name }}>
      <div
        data-slot="radio-group"
        role="radiogroup"
        className={cn("grid gap-3", className)}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
}

function RadioGroupItem({ value, className, ...props }: RadioGroupItemProps) {
  const context = React.useContext(RadioGroupContext);
  const isChecked = context?.value === value;

  return (
    <input
      type="radio"
      data-slot="radio-group-item"
      name={context?.name}
      value={value}
      checked={isChecked}
      onChange={() => context?.onValueChange(value)}
      className={cn("radio radio-primary", className)}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
