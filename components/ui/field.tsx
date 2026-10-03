"use client"

import * as React from "react"
import { cn } from "cn"

interface FieldProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical"
}

function Field({ className, orientation = "vertical", ...props }: FieldProps) {
  return (
    <div
      data-slot="field"
      data-orientation={orientation}
      className={cn(
        "flex w-full group/field transition-all select-none",
        orientation === "horizontal"
          ? "flex-row items-center justify-between gap-3"
          : "flex-col gap-1.5",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "cursor-pointer w-full flex items-center justify-between gap-3 text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("flex flex-col gap-0.5 flex-1 min-w-0", className)}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-title"
      className={cn("text-xs font-semibold text-foreground truncate", className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-[11px] text-muted-foreground truncate", className)}
      {...props}
    />
  )
}

export { Field, FieldLabel, FieldContent, FieldTitle, FieldDescription }
