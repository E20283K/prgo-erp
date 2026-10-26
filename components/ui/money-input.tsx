"use client";

import * as React from "react";
import {
  NumericFormat,
  type NumericFormatProps,
  type NumberFormatValues,
  type SourceInfo,
} from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<NumericFormatProps, "onValueChange"> {
  onValueChange?: (values: NumberFormatValues, sourceInfo: SourceInfo) => void;
  onAmountChange?: (amount: number) => void;
  currency?: string;
  className?: string;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      thousandSeparator = " ",
      decimalSeparator = ".",
      allowNegative = false,
      value,
      onValueChange,
      onAmountChange,
      className,
      placeholder = "0",
      customInput = Input,
      ...props
    },
    ref
  ) => {
    const handleValueChange = React.useCallback(
      (values: NumberFormatValues, sourceInfo: SourceInfo) => {
        if (onValueChange) {
          onValueChange(values, sourceInfo);
        }
        if (onAmountChange) {
          onAmountChange(values.floatValue ?? 0);
        }
      },
      [onValueChange, onAmountChange]
    );

    return (
      <NumericFormat
        getInputRef={ref}
        customInput={customInput}
        thousandSeparator={thousandSeparator}
        decimalSeparator={decimalSeparator}
        allowNegative={allowNegative}
        value={value ?? ""}
        onValueChange={handleValueChange}
        placeholder={placeholder}
        className={cn("font-mono", className)}
        {...props}
      />
    );
  }
);

MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
export type { NumberFormatValues, SourceInfo };
