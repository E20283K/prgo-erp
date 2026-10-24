"use client"

import * as React from "react"
import { PatternFormat, type PatternFormatProps } from "react-number-format"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface PhoneInputProps
  extends Omit<PatternFormatProps, "format" | "onChange" | "value"> {
  format?: string
  value?: string | number | null
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}

function normalizeUzPhoneDigits(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ""
  const str = String(val).trim()
  if (!str) return ""
  const digits = str.replace(/\D/g, "")
  if (!digits) return ""

  // If starts with +998 or digits start with 998 and length >= 10
  if (str.startsWith("+998") || (digits.startsWith("998") && digits.length >= 10)) {
    return digits.slice(3, 12)
  }
  if (str.startsWith("+")) {
    const afterPlus = digits.startsWith("998") ? digits.slice(3, 12) : digits
    return afterPlus.slice(0, 9)
  }
  return digits.slice(0, 9)
}

function PhoneInput({
  format = "+998 ## ###-##-##",
  mask = "_",
  allowEmptyFormatting = false,
  value,
  onChange,
  onValueChange,
  className,
  placeholder = "+998 90 123-45-67",
  ...props
}: PhoneInputProps) {
  const isUzFormat = format.startsWith("+998")

  const normalizedValue = React.useMemo(() => {
    if (!isUzFormat) return (value ?? "") as string
    return normalizeUzPhoneDigits(value)
  }, [value, isUzFormat])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      if (isUzFormat) {
        const rawDigits = e.target.value.replace(/\D/g, "")
        const hasUserDigits = rawDigits.startsWith("998") ? rawDigits.length > 3 : rawDigits.length > 0
        if (!hasUserDigits) {
          e.target.value = ""
        }
      }
      onChange(e)
    }
  }

  return (
    <PatternFormat
      customInput={Input}
      format={format}
      mask={mask}
      allowEmptyFormatting={allowEmptyFormatting}
      value={normalizedValue}
      onChange={handleChange}
      onValueChange={onValueChange}
      placeholder={placeholder}
      className={cn("font-mono", className)}
      {...props}
    />
  )
}

export { PhoneInput, normalizeUzPhoneDigits }
