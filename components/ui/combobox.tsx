"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ChevronDownIcon, XIcon, CheckIcon } from "lucide-react"

const Combobox = ComboboxPrimitive.Root

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  )
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean
  showClear?: boolean
}) {
  return (
    <InputGroup className={cn("w-full", className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent cursor-pointer"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          {...props}
          style={{
            width: "max-content",
            minWidth: "max(var(--anchor-width, 0px), 220px)",
            maxWidth: "min(var(--available-width, 95vw), 480px)",
            ...props.style,
          }}
          className={cn(
            "group/combobox-content relative max-h-[min(320px,var(--available-height,320px))] w-max min-w-[var(--anchor-width)] max-w-[min(var(--available-width,95vw),480px)] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg border border-border duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "no-scrollbar max-h-64 scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1.5 pr-8 pl-2.5 text-xs outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none size-3.5" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  )
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "hidden w-full justify-center py-2.5 text-center text-xs text-muted-foreground group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  )
}

function ComboboxSeparator({
  className,
  ...props
}: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-data-[slot=combobox-chip]:px-1 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-none", className)}
      {...props}
    />
  )
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export interface ComboboxOption {
  value: string
  label: string
  description?: string
}

export interface ComboboxSelectProps {
  items: readonly (string | ComboboxOption)[] | (string | ComboboxOption)[]
  value?: string | number | null
  onValueChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowCustom?: boolean
  onAddNew?: (val: string) => void
}

function ComboboxSelect({
  items,
  value,
  onValueChange,
  placeholder = "Tanlang...",
  disabled = false,
  className,
  allowCustom = false,
  onAddNew,
}: ComboboxSelectProps) {
  const normalizedItems = React.useMemo<ComboboxOption[]>(() => {
    return items.map((it) => {
      if (typeof it === "string" || typeof it === "number") {
        return { value: String(it), label: String(it) }
      }
      return it
    })
  }, [items])

  const strValue = value !== undefined && value !== null ? String(value) : ""
  const selectedItem = React.useMemo(() => {
    if (!strValue) return null
    return (
      normalizedItems.find((it) => it.value === strValue) || {
        value: strValue,
        label: strValue,
      }
    )
  }, [normalizedItems, strValue])

  const [inputVal, setInputVal] = React.useState(selectedItem?.label || "")

  React.useEffect(() => {
    setInputVal(selectedItem?.label || "")
  }, [selectedItem])

  const effectiveItems = React.useMemo(() => {
    if (!allowCustom || !inputVal.trim()) return normalizedItems
    const exists = normalizedItems.some(
      (it) =>
        it.value.toLowerCase() === inputVal.trim().toLowerCase() ||
        it.label.toLowerCase() === inputVal.trim().toLowerCase()
    )
    if (!exists) {
      return [{ value: inputVal.trim(), label: inputVal.trim() }, ...normalizedItems]
    }
    return normalizedItems
  }, [normalizedItems, inputVal, allowCustom])

  return (
    <Combobox
      items={effectiveItems}
      value={selectedItem}
      itemToStringLabel={(item: ComboboxOption | null) => item?.label || ""}
      itemToStringValue={(item: ComboboxOption | null) => item?.value || ""}
      isItemEqualToValue={(a: ComboboxOption | null, b: ComboboxOption | null) => a?.value === b?.value}
      onValueChange={(val: ComboboxOption | null) => {
        const next = val?.value || ""
        onValueChange(next)
        if (next && onAddNew && !normalizedItems.some((it) => it.value === next)) {
          onAddNew(next)
        }
      }}
      onInputValueChange={(q) => {
        setInputVal(q)
      }}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={placeholder}
        title={selectedItem?.label || undefined}
        className={cn("w-full h-8 text-xs bg-muted/20 font-normal", className)}
        disabled={disabled}
        onKeyDown={(e) => {
          if (allowCustom && e.key === "Enter" && inputVal.trim()) {
            const trimmed = inputVal.trim()
            onValueChange(trimmed)
            onAddNew?.(trimmed)
          }
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty>Hech narsa topilmadi</ComboboxEmpty>
        <ComboboxList>
          {(item: ComboboxOption) => (
            <ComboboxItem key={item.value} value={item}>
              <div className="flex flex-col min-w-0 flex-1 pr-1 py-0.5">
                <span className="text-xs font-medium leading-normal whitespace-normal break-words">{item.label}</span>
                {item.description && (
                  <span className="text-[10px] text-muted-foreground leading-normal whitespace-normal break-words mt-0.5">{item.description}</span>
                )}
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxSelect,
  useComboboxAnchor,
}
