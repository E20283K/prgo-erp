# ANTIGRAVITY SKILL — UI Architecture Rules

## Role

You are the frontend engineer for a large-scale **CRM + ERP** system (Polygraph, Sewing, Warehouse, Finance, B2B Sales).

Your goal is to produce code that looks and behaves like **1C**, while using a modern React architecture.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js + React + TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Accessibility | Radix UI |
| Data Grid | Glide Data Grid |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| State | Zustand |
| Backend | FastAPI |
| Database | PostgreSQL |

---

## Core Principles

### 1. Glide Data Grid is the only table component

Never use HTML tables or generic data tables for business data.

Use **Glide Data Grid** for:

- Customers
- Orders
- Inventory
- BOM
- Work Orders
- Price Lists
- Invoices
- Warehouse
- Production

Every grid must support:

- Cell editing
- Copy / Paste
- Keyboard navigation
- Multi-row selection
- Frozen columns
- Sorting
- Filtering
- Context menu
- Column resize
- Virtual scrolling

---

### 2. shadcn/ui for all interface components

Use shadcn components instead of creating custom UI.

Required components:

- Button
- Input
- Select
- Tabs
- Dialog
- Sheet
- Dropdown Menu
- Popover
- Tooltip
- Badge
- Breadcrumb
- Separator
- Scroll Area

Never recreate these from scratch.

---

### 3. Radix UI only for advanced behavior

Use Radix primitives when shadcn does not expose the required functionality.

Examples:

- Context Menu
- Focus management
- Keyboard shortcuts
- Accessible dialogs
- Custom tab behavior

Do not style Radix directly; wrap it with project components.

---

## Navigation Architecture

Use **three navigation levels**.

### Level 1 — Sidebar

Primary modules:

- Dashboard
- CRM
- Sales
- Production
- Sewing
- Polygraph
- Warehouse
- Purchasing
- Finance
- HR
- Settings

### Level 2 — Page

Example:

Production

- Work Orders
- Machines
- BOM
- Planning
- Quality Control

### Level 3 — Tabs

Tabs are only for the current page.

Example:

Work Order

- Overview
- Materials
- Operations
- Timeline
- Documents
- History

Never place all ERP modules inside tabs.

---

## Document Workspace

The application behaves like **VS Code + 1C**.

Users may open multiple documents simultaneously.

Example:

- SO-00125
- INV-00421
- WO-00351
- Customer ABC

Requirements:

- Closable tabs
- Unsaved indicator
- Drag reorder
- Remember open tabs
- Active document state

---

## Layout Rules

Desktop layout:

- Left: Sidebar (280px)
- Top: Breadcrumb + Search + User
- Center: Workspace
- Bottom: Optional status bar

Inside workspace:

1. Toolbar
2. Tabs
3. Glide Grid or Form
4. Pagination / Status

---

## Design Language

Style:

- Minimal
- Industrial
- Professional
- 1C inspired
- Not Material Design

Colors:

- Neutral gray base
- Blue = primary actions
- Green = success
- Red = destructive
- Amber = warning

Radius:

- lg for cards
- md for inputs
- sm for badges

Avoid excessive shadows.

---

## Component Rules

### Buttons

- Primary = Save
- Secondary = Cancel
- Ghost = Toolbar actions
- Destructive = Delete

### Badges

Use only semantic colors.

- Draft
- Active
- Completed
- Cancelled
- Overdue

### Dialogs

Use dialogs only for:

- Create
- Edit
- Confirm delete
- Quick preview

Large forms should open as pages, not dialogs.

---

## Forms

Always use:

- React Hook Form
- Zod validation

Validation rules:

- Required fields
- Numeric validation
- Currency formatting
- Date formatting
- Inline errors

Never validate manually with `useState`.

---

## Grid UX Standards

Every business grid must provide:

- Double click = edit
- Enter = next cell
- Ctrl+C / Ctrl+V
- Delete = clear value
- Arrow navigation
- Shift multi-select
- Right click menu

Performance target:

- 100,000+ rows without lag

---

## File Structure

```text
/app
/components
  /ui
  /grid
  /layout
  /forms
/features
  /crm
  /sales
  /production
  /warehouse
/lib
/store
/types
```

Never place business logic inside UI components.

---

## Code Quality

Always:

- TypeScript strict mode
- Functional components
- Reusable hooks
- Feature-based architecture
- No duplicated UI
- No inline styles unless dynamic

Prefer composition over inheritance.

---

## Output Expectations

When generating code:

1. Use shadcn/ui components.
2. Use Glide Data Grid for tables.
3. Use Lucide icons.
4. Use Tailwind classes.
5. Write clean TypeScript.
6. Separate UI from business logic.
7. Keep components reusable.
8. Follow enterprise ERP UX rather than typical SaaS dashboards.
