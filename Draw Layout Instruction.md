# Print Layout Calculator — Development Instruction

Build a visual **Print Sheet Layout Calculator** for the Polygraph module.

## Purpose

The user enters:

- Sheet size
- Product size
- Quantity
- Bleed
- Gap
- Margins
- Gripper
- Rotation

The application calculates how many products fit on one sheet and visually draws the result.

## UI

Use a two-part layout:

### Left — Calculation Inputs

Use normal form controls or a compact data grid.

Fields:

- Sheet Width
- Sheet Height
- Product Width
- Product Height
- Quantity
- Bleed
- Gap
- Margin Top
- Margin Bottom
- Margin Left
- Margin Right
- Gripper

Actions:

- Calculate
- Reset

Display:

- Pieces per sheet
- Required sheets
- Used area
- Waste area
- Utilization %
- Orientation

### Right — Visual Layout

Draw the sheet using **SVG**.

The SVG must show:

- Full sheet boundary
- Printable/usable area
- Every imposed product
- Product dimensions
- Bleed
- Gaps
- Margins
- Gripper area
- Product numbering
- Rotation/orientation

The sheet should automatically scale to fit the available workspace while preserving the real aspect ratio.

## Calculation

Calculate both orientations.

### Orientation A

```text
columns = floor(usableWidth / itemWidth)
rows = floor(usableHeight / itemHeight)

pieces = columns × rows