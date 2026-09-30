---
name: ui-architecture
description: >-
  Use this skill whenever generating, modifying, or refactoring UI components, pages, forms, or data grids for the PrintGoo ERP/CRM system. Enforces 100% compliance with shadcn/ui official components, Tailwind CSS semantic tokens, Glide Data Grid, Lucide icons, and 1C enterprise UX patterns.
---

# PrintGoo ERP / CRM — UI Code Generation Skill

This skill enforces strict, production-ready frontend standards across the entire PrintGoo Ecosystem. It ensures all generated UI follows modern React + Next.js architecture while maintaining the dense, keyboard-centric, industrial reliability of **1C Enterprise + VS Code**.

---

## 1. Golden Rule: 100% shadcn/ui Component Usage

**Never write raw, unstyled HTML elements for interactive UI** (`<button>`, `<input>`, `<select>`, modal divs, etc.). Every web component must be imported from `@/components/ui/*` and adhere strictly to official [shadcn/ui](https://ui.shadcn.com) patterns.

### Component Manifest & Mapping

| UI Need | Required shadcn/ui Component | Source Import |
|---|---|---|
| Buttons & Actions | `Button` | `@/components/ui/button` |
| Text / Search / Number Inputs | `Input` | `@/components/ui/input` |
| Select / Dropdowns | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | `@/components/ui/select` |
| Navigation & Document Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/components/ui/tabs` |
| Popups & Detail Panels | `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter` | `@/components/ui/dialog` |
| Side Drawers & Inspectors | `Sheet`, `SheetContent`, `SheetHeader` | `@/components/ui/sheet` |
| Menus & Context Options | `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem` | `@/components/ui/dropdown-menu` |
| Right-Click Grids & Tabs | `ContextMenu`, `ContextMenuContent`, `ContextMenuItem` | `@/components/ui/context-menu` |
| Hover Info & Hotkey Hints | `Tooltip`, `TooltipTrigger`, `TooltipContent` | `@/components/ui/tooltip` |
| Status & Segment Labels | `Badge` | `@/components/ui/badge` |
| Breadcrumbs & Path Tracking | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem` | `@/components/ui/breadcrumb` |
| Visual Dividers | `Separator` | `@/components/ui/separator` |
| Scrollable Containers | `ScrollArea` | `@/components/ui/scroll-area` |

*If a new shadcn component is required, run `npx shadcn@latest add <component> -y` before writing code.*

---

## 2. Design System: Colors, Tokens & Typography

### Semantic Color System (No Arbitrary Colors)
Never hardcode hex values (`#383838`, `#eee`) or random arbitrary classes. Use Tailwind CSS semantic CSS variable tokens:

- **Surface / Backgrounds**: `bg-background`, `bg-card`, `bg-muted`, `bg-secondary`
- **Text / Foregrounds**: `text-foreground`, `text-muted-foreground`, `text-primary-foreground`
- **Borders & Dividers**: `border-border`, `border-input`
- **Primary Actions (Save, Submit, Post)**: `bg-primary`, `hover:bg-primary/90`, `text-primary-foreground` (1C Blue accent: `#2563eb`)
- **Semantic Badges & Indicators**:
  - **Draft / In-Preparation**: Neutral muted (`bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`)
  - **Active / In-Production**: Success emerald (`bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300`)
  - **Completed / Shipped**: Blue accent (`bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300`)
  - **Cancelled / Rejected**: Destructive red (`bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300`)
  - **Urgent / Warning**: Amber/Orange (`bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300`)

### Typography & Information Density
- **Font Stack**:
  - UI Labels, Headers, Text: `Geist Sans`, `Inter`, sans-serif (`font-sans`)
  - Document IDs, Numbers, Financials, Dates, Code: `Geist Mono`, monospace (`font-mono`)
- **Density Standard (1C Industrial Standard)**:
  - Form inputs: Height `h-7` or `h-8` (`text-xs`), compact padding (`px-2 py-1`)
  - Table row height: `26px` to `28px`
  - Table header height: `28px` to `30px`
  - Workspace tabs height: `h-7` or `h-8`
  - Avoid excessive spacing, generous margins, or low-density mobile designs.

### Iconography Standards
- Use **only** `lucide-react`.
- Standard sizes:
  - Toolbar & inline actions: `w-3.5 h-3.5` (size-3.5)
  - Sidebar modules: `w-4 h-4` (size-4)
  - Status indicators: `w-3 h-3` (size-3)
- Always pair icons with accessible text labels or `Tooltip`.

---

## 3. Data Grid: Glide Data Grid Exclusivity

**Rule: HTML tables (`<table>`) are prohibited for business entities.**
Always use `@glideapps/glide-data-grid` for tabular business data (Orders, Work Orders, BOM, Invoices, Warehouse Stock, Customers).

### Mandatory Grid Capabilities
Every Glide Data Grid implementation must supply:
1. **Dynamic Import with `ssr: false`**: Required in Next.js App Router to avoid `window is not defined` server prerendering errors.
2. **Frozen Key Columns**: Freeze document ID / Code column (`freezeColumns={1}`).
3. **Row & Header Markers**: Enable row indices (`rowMarkers="both"`).
4. **Virtual Scrolling**: Native canvas virtual rendering supporting 100,000+ rows smoothly.
5. **Inline Cell Editing**: Implement `onCellEdited` callback updating the state model.
6. **Column Resizing**: Implement `onColumnResize` callback updating column widths.
7. **Selection Support**: Bind `gridSelection` and `onGridSelectionChange`.
8. **Double-Click Row to Open**: Implement `onCellActivated` to open the record as a new document tab in the workspace store.
9. **Radix Context Menu**: Wrap the grid in `ContextMenu` with actions (`Open Document F12`, `New Record Ins`, `Set Status`, `Copy Selection Ctrl+C`, `Delete Del`).

### Grid Theme Configuration
Always provide the high-density neutral enterprise theme:
```tsx
theme={{
  accentColor: "#2563eb",
  accentLight: "rgba(37, 99, 235, 0.12)",
  bgCell: "#ffffff",
  bgCellMedium: "#f8fafc",
  bgHeader: "#f1f5f9",
  bgHeaderHasFocus: "#e2e8f0",
  bgHeaderHovered: "#e2e8f0",
  textDark: "#0f172a",
  textMedium: "#475569",
  textLight: "#64748b",
  textHeader: "#334155",
  borderColor: "#e2e8f0",
  fontFamily: "Inter, -apple-system, sans-serif",
  baseFontStyle: "12px sans-serif",
  headerFontStyle: "bold 11px sans-serif",
}}
```

---

## 4. Navigation Architecture: Three Levels

Follow the 3-level navigation hierarchy:

```text
Level 1: Left Sidebar (280px)
  └── Modules (Production, Polygraph, Sewing, CRM, Sales, Warehouse, Finance, HR)
        │
        ├── Level 2: Sub-module / Page Header & Breadcrumbs
        │     └── (e.g. Production -> Work Orders, Machines, BOM, Planning, QC)
        │
        └── Level 3: In-Document Workspace Tabs (for opened documents)
              └── (e.g. WO-00351 -> Overview, BOM & Materials, Operations, Timeline, History)
```

**Never place all ERP modules inside tabs!** Tabs are reserved for concurrent open documents and active records (VS Code style).

---

## 5. Document Workspace: VS Code + 1C Model

State is managed globally in `@/store/workspaceStore.ts`:
- **Simultaneous Open Documents**: Users can open multiple registries, work orders, BOMs, or invoices simultaneously.
- **Unsaved Indicator**: Unsaved changes show an active blue dot on the tab.
- **Tab Context Menu**: Right-click on tabs allows *Close*, *Close Others*, *Close to Right*, and *Copy ID*.
- **Standard Document Actions (1C Standard)**:
  - **Post & Close (`Провести и закрыть`)**: `Button` (Primary Blue) — validates, commits transactions, and closes tab.
  - **Save (`Записать`)**: `Button` (Outline) — saves changes and removes the unsaved dot.
  - **Print (`Печать`)**: `Button` (Ghost) — triggers specification printing.

---

## 6. Forms & Data Validation

- **Form Management**: `react-hook-form` + `@hookform/resolvers/zod` + `zod`.
- **Validation**:
  - Strict Zod schemas for all document payloads.
  - Required fields highlighted with asterisk and inline error messages (`text-[11px] text-destructive`).
  - Strict currency, numerical, and date formatting.
- **Form Layout**: High-density grid cards (`grid grid-cols-1 md:grid-cols-3 gap-3`).
- **Pages vs Dialogs**: Large forms must open as workspace document tabs. Dialogs are reserved only for quick actions, confirmations, and parameter prompts.

---

## 7. Status Bar Standards

Every desktop view must include the fixed 1C bottom status bar (`components/layout/StatusBar.tsx`) indicating:
1. Database engine & cluster status (`PostgreSQL: Connected (pg-prod-01)`)
2. Current plant / branch location
3. Active grid record counts (`1,250 records (X selected)`)
4. Active cell coordinates (`R12:C3`)
5. Roundtrip network latency (`12ms`)
6. Current logged-in operator and active shift.

---

## 8. Generation Checklist for Agents

Before completing any UI task, verify:
- [ ] Are all interactive elements using `@/components/ui/*` (shadcn/ui)?
- [ ] Are all tables powered by `@glideapps/glide-data-grid`?
- [ ] Is dynamic import with `ssr: false` used for Glide Data Grid?
- [ ] Are all colors mapped to semantic tokens (`bg-primary`, `text-muted-foreground`, etc.)?
- [ ] Are Lucide icons properly sized (`w-3.5 h-3.5` or `w-4 h-4`)?
- [ ] Does double-clicking a record open a document tab in `workspaceStore`?
- [ ] Does the document follow the Level 3 tab structure (Overview, Materials, Operations)?
- [ ] Does `npm run build` pass without TypeScript or SSR errors?
