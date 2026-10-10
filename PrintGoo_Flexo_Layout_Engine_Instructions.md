# PrintGoo — Flexo Layout Engine & SVG Preview Implementation Instructions

## 1. Purpose

Extend the existing Order Details workflow in PrintGoo with a **Flexo-specific calculation and layout section**.

The current order detail structure contains:

- Overview
- Layout
- Cost Calculation
- Physical Sample
- Audit Trail

The existing `Layout` section is primarily a **sheet/imposition layout engine** suitable for offset/sheet-based production.

Do **not** replace or redesign the existing Offset Layout Engine.

Add a separate **Flexo** section/engine that is shown only when the order's printing method/process requires flexographic printing.

Recommended order tabs:

```text
Overview
Layout          ← Offset / sheet-based layout
Flexo           ← Flexographic layout & yield calculation
Cost Calculation
Physical Sample
Audit Trail
```

For an order that is exclusively Flexo, it is acceptable to hide the irrelevant Offset `Layout` tab and show:

```text
Overview
Flexo
Cost Calculation
Physical Sample
Audit Trail
```

Use the project's existing architecture, design system, components, routing, state management, persistence, and naming conventions. **Do not rewrite existing modules unnecessarily.**

---

# 2. Core Architecture

The Flexo feature must be implemented as a **calculation engine + structured result + SVG renderer**.

Do NOT make the SVG itself the source of truth.

Use this conceptual architecture:

```text
Order
  ↓
Flexo Inputs
  ↓
Flexo Calculation Engine
  ↓
Structured Flexo Layout Result
  ↓
SVG Renderer
  ├── Browser Preview
  └── SVG Download
  ↓
PDF / Print Specification
```

The calculation result must be stored as structured data.

SVG is only a visual/vector representation of that result.

The renderer must never contain the business logic that decides how many products fit, which cylinder is selected, or how production quantity is calculated.

---

# 3. Why Flexo Is Different From Offset Layout

The existing Offset Layout Engine is sheet-oriented:

```text
Sheet W/H
Product W/H
Bleed
Gap/Gutter
Margins
Gripper
Slots / Sheet
Yield
```

Flexo must NOT simply reuse that calculation model.

Flexo is primarily a **web + repeat + cylinder + across-count** problem.

The Flexo engine should calculate:

```text
Material / Web
    ↓
Web Width
    ↓
Product dimensions
    ↓
Gap / Bleed
    ↓
Machine Direction
    ↓
Cylinder / Gear
    ↓
Repeat
    ↓
Across count
    ↓
Material consumption
    ↓
Production quantity
    ↓
Waste / yield
```

The main question is:

> How should the label/artwork repeat across the web and around the printing repeat, and how much material is required to produce the required quantity?

---

# 4. Flexo Inputs

Build the UI around the existing project's component style.

At minimum support:

### Machine / Process

- Machine
- Printing process: Flexo
- Printing direction / machine direction
- Available cylinder/gear system

### Material

- Material
- Material width / web width
- Optional usable print width
- Material specification relevant to the order

Typical materials include:

- Satin
- Nylon
- Textile label materials
- Care-label materials
- Size-label materials
- Other narrow-web label materials

Do not hard-code these materials unless the existing database already does so.

### Product

- Product width
- Product height
- Orientation
- Bleed
- Horizontal gap
- Vertical gap

### Printing

- Number of colors / plates
- Plate thickness
- Cylinder / gear selection
- Repeat

### Quantity

- Required quantity
- Overproduction allowance
- Production target quantity

The existing project's overproduction logic should be reused where possible.

---

# 5. Cylinder / Gear Master Data

The project has a reference PDF named:

`JR-1521 Printing Cylinder and Gear Data.pdf`

It contains a table with:

- Gear teeth number
- Pitch circle diameter
- Plate thickness
- Print cylinder diameter
- Film length
- Printing length

The supplied reference uses a **1.7 mm plate thickness** and lists gear/cylinder data from approximately 40T through 149T.

Examples from the reference:

```text
60T
Pitch circle diameter: 51.77 mm
Plate thickness: 1.7 mm
Print cylinder diameter: 48.27 mm
Film length: 153.34 mm
Printing length: 162.64 mm
```

```text
100T
Pitch circle diameter: 86.28 mm
Plate thickness: 1.7 mm
Print cylinder diameter: 82.78 mm
Film length: 261.77 mm
Printing length: 271.07 mm
```

```text
110T
Pitch circle diameter: 94.91 mm
Plate thickness: 1.7 mm
Print cylinder diameter: 91.41 mm
Film length: 288.88 mm
Printing length: 298.17 mm
```

These values are source/reference data and should NOT be treated as a universal specification for every Flexo machine.

Important:
- Model cylinder/gear specifications per machine or gear system.
- Do not assume that every Flexo machine uses the same pitch, gear system, plate thickness, or cylinder data.
- Do not silently extrapolate or modify manufacturer/reference values.
- If importing the provided PDF table into seed/master data, preserve the supplied values and flag questionable source data for human verification instead of silently correcting it.

The provided PDF contains apparent suspicious values in at least one row (for example, the 126T row). Do not automatically "fix" such source values. Mark them as needing verification.

---

# 6. Cylinder Selection

Cylinder selection must be a controlled calculation/input, not an arbitrary text field.

The UI should allow:

```text
Cylinder / Gear
[ 100T ▼ ]

Gear teeth:       100
Cylinder Ø:       82.78 mm
Film length:      261.77 mm
Printing length:  271.07 mm
Plate thickness:  1.70 mm
```

When a cylinder is selected, its technical values should be displayed.

If the system supports automatic selection, it should:

1. Read available cylinders for the selected machine/gear system.
2. Evaluate product/repeat requirements.
3. Return valid candidate cylinders.
4. Rank candidates by defined optimization rules.
5. Let the user explicitly select/confirm the final cylinder.

Do not silently choose a cylinder without showing the reason/result.

---

# 7. Flexo Layout Calculation

The engine should produce a structured result such as:

```ts
type FlexoLayoutResult = {
  machineId: string;
  materialId: string;

  webWidth: number;
  usablePrintWidth?: number;

  productWidth: number;
  productHeight: number;

  bleedX?: number;
  bleedY?: number;

  gapX: number;
  gapY: number;

  orientation: "normal" | "rotated";

  gearTeeth: number;
  cylinderDiameter: number;
  filmLength: number;
  printingLength: number;
  plateThickness: number;

  acrossCount: number;

  requiredQuantity: number;
  overproductionAllowance: number;
  productionTargetQuantity: number;

  materialConsumption?: number;
  waste?: number;
  yield?: number;

  positions: FlexoLayoutPosition[];

  dimensions: FlexoLayoutDimensions;

  marks?: FlexoMark[];

  colors?: FlexoColorSeparation[];

  warnings: FlexoLayoutWarning[];
};
```

Adapt naming/types to the project's existing code conventions.

Do not blindly copy this TypeScript definition if the project uses another architecture.

---

# 8. Across Calculation

The engine must calculate how many products fit across the web.

Conceptually:

```text
usable web width
    ↓
product width + horizontal spacing
    ↓
maximum valid across count
```

Account for:

- Product width
- Bleed
- Gap
- Usable web width
- Side margins if applicable
- Orientation

The calculation must explicitly distinguish:

- Product size
- Printed/artwork size
- Bleed size
- Gap
- Usable web width
- Total occupied width
- Side waste

Do not mix these values.

---

# 9. Repeat Calculation

Repeat is a first-class Flexo parameter.

The preview and calculation must distinguish between:

- Film length
- Printing length / production repeat
- Product height
- Vertical gap
- Plate dimensions

Do not label every value simply as `Repeat`.

Where the machine/reference data provides both:

```text
Film length
Printing length
```

keep both values.

The reference PDF, for example, gives for 100T:

```text
Film length: 261.77 mm
Printing length: 271.07 mm
```

Use the correct value for the corresponding calculation and label them clearly.

---

# 10. SVG Preview — General Principle

SVG is the correct format for this preview.

Do not use a raster screenshot as the primary representation.

The SVG must be:

- Vector
- Scalable
- Zoomable
- Dimension-aware
- Exportable
- Deterministic from the calculation result

The browser preview and downloaded SVG must be generated from the same structured layout result.

Do not store a manually edited SVG as the calculation source of truth.

---

# 11. SVG Preview Content

The SVG preview should be a **technical production visualization**, not merely a decorative illustration.

It should communicate four things:

1. Geometry
2. Imposition/layout
3. Repeat/cylinder relationship
4. Production information

The preview should contain the following where applicable.

## 11.1 Header

Include compact technical information:

```text
FLEXO LAYOUT

Order:        ORD-XXXX
Product:      Care Label
Material:     Satin

Machine:      Flexo 01
Cylinder:     100T
Repeat:       271.07 mm
Across:       2
Colors:       4
Plate:        1.70 mm
```

Use actual order/product values from the application.

---

# 12. Web Representation

The main visual area must show the material/web.

Example:

```text
                 MACHINE DIRECTION →
     ←──────────── 100 mm WEB ────────────→

     ┌─────────────────────────────────────┐
     │                                     │
     │  ┌────────────┐  ┌────────────┐     │
     │  │   LABEL    │  │   LABEL    │     │
     │  │            │  │            │     │
     │  └────────────┘  └────────────┘     │
     │                                     │
     │                                     │
     └─────────────────────────────────────┘
```

The web width must be visually identifiable.

Machine direction must be clearly indicated.

---

# 13. Product Boundaries

Every placed label/product should have a visible boundary.

Show:

- Product width
- Product height
- Orientation
- Optional bleed boundary

Example:

```text
          ←──── 50 mm ────→

       ┌─────────────────────┐
       │                     │
       │     CARE LABEL      │
       │                     │
       └─────────────────────┘
               25 mm
```

If actual artwork is available as SVG/vector data, render the actual artwork when practical.

If actual artwork rendering is not yet supported, use a clear placeholder but preserve the exact product boundary and dimensions.

Do not fake production artwork.

---

# 14. Gaps

Visually distinguish:

- Horizontal gap
- Vertical gap

Show dimension annotations when the preview is in Technical mode.

Example:

```text
┌────────────┐
│   LABEL    │
└────────────┘
       ↕
      2 mm
       ↕
┌────────────┐
│   LABEL    │
└────────────┘
```

---

# 15. Repeat Boundary

Show the production repeat boundary with a distinct dashed/dotted line.

Example:

```text
        ←──────── 271.07 mm ────────→

        ┌─────────────────────────────┐
        │                             │
        │ LABEL          LABEL        │
        │                             │
        ├ - - - REPEAT BOUNDARY - - -┤
        │                             │
        └─────────────────────────────┘
```

The user must be able to visually understand what repeats around the cylinder.

---

# 16. Dimensions

Technical dimension lines should be available.

At minimum, support dimensions for:

- Web width
- Product width
- Product height
- Horizontal gap
- Vertical gap
- Printing repeat
- Plate area where applicable

Do not overcrowd the default view.

Use a `Technical` view/toggle to expose more dimensions.

---

# 17. Plate Boundary

Keep these concepts visually separate:

```text
WEB
┌───────────────────────────────────┐
│                                   │
│     PLATE / PRINT AREA            │
│                                   │
│       LABEL     LABEL             │
│                                   │
└───────────────────────────────────┘
```

Do not confuse:

- Material/web boundary
- Product boundary
- Repeat boundary
- Plate boundary

Each should use a different visual treatment.

---

# 18. Machine / Registration Marks

Where required by the project's real production specification, support:

- Registration marks
- Color marks
- Machine/reference marks
- Other production marks

Do not invent production marks or dimensions.

Make them configurable based on machine/process requirements.

---

# 19. Color Separations

If the order has multiple colors/plates, support a separation view.

Main preview:

```text
4 COLORS
```

Optional controls:

```text
[ All ] [ C ] [ M ] [ Y ] [ K ] [ Spot 1 ]
```

Clicking a separation should show only that color/plate's relevant artwork when separation data exists.

Do not fabricate color separation information if the order/artwork does not contain it.

---

# 20. Preview Modes

Implement three conceptual views if the existing UI architecture allows it:

### Production View

For operator:

- Web
- Product
- Repeat
- Across count
- Gaps
- Machine direction
- Production marks

### Plate View

For prepress:

- Plate boundary
- Artwork
- Repeat
- Color/plate information
- Relevant mounting/reference marks

### Technical View

For technologist:

- Web width
- Product dimensions
- Gaps
- Cylinder data
- Gear teeth
- Cylinder diameter
- Film length
- Printing length
- Plate thickness
- Repeat dimensions

Suggested UI:

```text
[ Production ] [ Plate ] [ Technical ]
```

If implementation scope requires a simpler first version, build Production + Technical first.

---

# 21. Preview Controls

The SVG viewer should support:

```text
[ − ]  100%  [ + ]  [ Fit ]  [ 1 Repeat ]
```

Recommended optional toggles:

```text
[ Show Dimensions ]
[ Show Marks ]
[ Show Gaps ]
[ Show Plate ]
```

Do not make controls overly complex.

---

# 22. One Repeat vs Preview Run

Support two visualization modes.

### 1 Repeat

Show exactly one repeat for technical inspection.

### Preview Run

Show several repeated cycles (for example 5–10) to demonstrate continuity.

Do not attempt to render the full production quantity.

Example:

```text
1 Repeat
────────────────
LABEL LABEL
────────────────
```

versus:

```text
Preview Run
────────────────
LABEL LABEL
LABEL LABEL
LABEL LABEL
LABEL LABEL
LABEL LABEL
────────────────
```

The preview run is visual only; it must not affect quantity calculations.

---

# 23. Waste Visualization

If calculation determines unused web area, show it visually where appropriate.

Example:

```text
┌──────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐            │
│ │  LABEL   │ │  LABEL   │            │
│ └──────────┘ └──────────┘            │
│                                      │
│             UNUSED AREA              │
└──────────────────────────────────────┘
```

Also expose:

```text
Web width:       100 mm
Used width:       96 mm
Side waste:        4 mm
```

Only show these values when the calculation actually supports them.

---

# 24. Calculation Summary

Add a compact technical summary below/around the SVG:

```text
LAYOUT SUMMARY

Product size       50 × 25 mm
Across             2
Gap                2 mm
Repeat             271.07 mm
Web width          100 mm

Cylinder           100T
Cylinder Ø         82.78 mm

Required           100,000 pcs
Overproduction     5%
Production target  105,000 pcs

Material usage     ...
Waste              ...
Yield              ...
```

Use the actual calculated values.

Do not duplicate information unnecessarily if the surrounding UI already shows it.

---

# 25. Export

The Flexo section should support:

```text
[ SVG ] [ PDF ] [ Print Spec ]
```

## SVG

Use for:

- vector preview
- prepress reference
- external inspection
- downstream vector workflows

## PDF

Use for:

- production/technical documentation
- printing
- sharing

Do not convert a screenshot into a PDF.

Generate PDF from vector/technical data when the current architecture permits it.

## Print Spec

Integrate with the existing `Print Spec (Ctrl+P)` workflow.

The Flexo-specific technical data should appear in the order's print specification when the order is Flexo.

---

# 26. SVG Is Not the Final Plate Artwork

Keep this distinction explicit.

```text
Flexo Layout SVG
        ≠
Final Plate Artwork
```

The SVG preview represents:

- calculation
- positioning
- repeat
- dimensions
- production layout

It is not automatically the final photopolymer plate-production file.

Do not claim that the generated SVG is production-ready plate artwork unless the application's actual prepress workflow supports all required production transformations.

Potential future plate-production concerns may include:

- trapping
- distortion compensation
- screening
- separation
- plate technology
- mounting
- plate-specific marks

Do not implement these unless they are part of the existing requirements.

---

# 27. Recommended Rendering Architecture

Prefer a dedicated renderer:

```text
FlexoLayoutResult
        ↓
renderFlexoSVG(result, options)
        ↓
SVG string / SVG DOM
```

The renderer should be deterministic.

Conceptually:

```ts
renderFlexoSVG(
  layoutResult,
  {
    view: "production" | "plate" | "technical",
    showDimensions: boolean,
    showMarks: boolean,
    showGaps: boolean,
    showPlate: boolean,
    previewRepeats: number
  }
)
```

Adapt to the project's actual framework.

---

# 28. Library Recommendation

Do not introduce a drawing library just for basic SVG generation.

For the current requirement, **native SVG generation is preferred** because the Flexo preview is a deterministic technical visualization.

Use:

```text
SVG <rect>
SVG <line>
SVG <path>
SVG <text>
SVG <g>
SVG <image>
```

or the project's existing SVG utility/component system.

A canvas/editor library such as Fabric.js should only be introduced if the product later requires interactive manual editing such as:

- drag/drop positioning
- manually moving marks
- interactive rotation
- manually changing positions
- editing objects on the canvas

Do not add Fabric.js or another large dependency merely to draw rectangles and dimension lines.

---

# 29. Data Model Principles

Persist the calculation inputs and result separately where appropriate.

Do not persist only the generated SVG.

The order should remain reproducible.

At minimum the system must be able to answer:

- Which machine was used?
- Which material was used?
- What was the web width?
- Which cylinder/gear was selected?
- What was the cylinder diameter?
- What was the printing repeat?
- What plate thickness was used?
- How many across?
- What were the product dimensions?
- What gaps were used?
- What quantity was required?
- What overproduction allowance was used?
- What production quantity was calculated?
- What waste/yield was calculated?
- Which SVG/PDF representation was generated?

This is especially important for Audit Trail.

---

# 30. Audit Trail

Any meaningful Flexo calculation change should be auditable using the project's existing Audit Trail architecture.

Examples:

```text
Cylinder changed:
80T → 100T

Across changed:
2 → 3

Gap changed:
2 mm → 1.5 mm

Web width changed:
100 mm → 110 mm

Overproduction changed:
5% → 3%
```

Do not create a second unrelated audit system if one already exists.

---

# 31. Validation and Warnings

The engine should produce warnings rather than silently accepting invalid combinations.

Examples:

```text
⚠ Product exceeds usable web width.

⚠ Selected cylinder/repeat is incompatible with the configured layout.

⚠ Plate thickness does not match the selected cylinder specification.

⚠ Required production repeat cannot accommodate the configured layout.

⚠ Cylinder data requires verification.

⚠ No valid cylinder found for this configuration.
```

Do not invent technical tolerances.

Only validate tolerances that are defined in the existing product/machine specifications.

---

# 32. Performance

Do not render thousands or hundreds of thousands of repeated products in the SVG.

For example, if the order requires:

```text
105,000 pcs
```

the preview should show only:

- 1 repeat, or
- a small preview run

The calculation engine handles the full production quantity numerically.

This keeps the SVG fast and lightweight.

---

# 33. Responsive / UI Integration

The Flexo tab should visually match the existing Layout tab.

Recommended structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Flexo Layout Engine                     [Save] [Print Spec]  │
├─────────────────────┬────────────────────────────────────────┤
│ Calculation Inputs  │ SVG Preview                            │
│                     │                                        │
│ Machine             │ MACHINE DIRECTION →                   │
│ Material            │                                        │
│ Web Width           │ ┌──────────────────────────────────┐   │
│ Product             │ │                                  │   │
│ Gap                 │ │      LABEL       LABEL            │   │
│ Cylinder            │ │                                  │   │
│ Repeat              │ │      LABEL       LABEL            │   │
│ Colors              │ │                                  │   │
│                     │ └──────────────────────────────────┘   │
│ Calculation Summary │                                        │
├─────────────────────┴────────────────────────────────────────┤
│ [ Production ] [ Plate ] [ Technical ]                       │
│ [ SVG ] [ PDF ]                                               │
└──────────────────────────────────────────────────────────────┘
```

Reuse the current application's visual language instead of creating a new UI style.

---

# 34. Important UX Principle

Do not overload the user with all technical information at once.

Default view:

```text
Web
Product
Across
Repeat
Machine direction
Basic dimensions
```

Advanced/Technical view:

```text
Gear
Pitch circle
Cylinder diameter
Film length
Printing length
Plate thickness
Marks
Waste
Technical dimensions
```

The UI should remain understandable for production staff.

---

# 35. Do Not Break Existing Offset Layout

This implementation must be additive.

Do not:

- replace the existing Layout Engine
- change existing offset calculations unless required
- change existing slot/yield logic without a migration plan
- rename existing fields unnecessarily
- introduce Flexo fields into the Offset calculation model just to share UI
- make Offset and Flexo use the same mathematical model

Shared infrastructure is encouraged:

```text
Shared:
- Preview container
- Zoom/pan
- Export framework
- Print Spec
- Audit Trail
- UI components
- persistence conventions

Separate:
- Offset calculation engine
- Flexo calculation engine
- Offset renderer
- Flexo renderer
```

---

# 36. Implementation Order

Implement in this order:

## Phase 1 — Data model

Create/reuse:

- Flexo machine specification
- Gear/cylinder master data
- Flexo order inputs
- Flexo layout result

## Phase 2 — Calculation engine

Implement:

- Web width calculation
- Across calculation
- Gap calculation
- Cylinder/repeat selection
- Production quantity
- Material consumption
- Waste/yield where supported
- Validation/warnings

## Phase 3 — Basic SVG renderer

Implement:

- Web
- Products
- Across
- Repeat boundary
- Machine direction
- Basic dimensions

## Phase 4 — Technical SVG

Add:

- Cylinder information
- Gear teeth
- Film length
- Printing length
- Plate thickness
- Dimension lines
- Plate boundary
- Marks

## Phase 5 — Preview UX

Add:

- Production / Plate / Technical views
- Zoom
- Fit
- One Repeat / Preview Run
- Show/hide dimensions
- Show/hide marks

## Phase 6 — Export

Add:

- SVG download
- PDF export
- Print Spec integration

## Phase 7 — Audit

Integrate calculation changes with the existing Audit Trail.

---

# 37. Acceptance Criteria

The implementation is complete when:

### UI

- Flexo tab exists.
- It appears only for relevant Flexo orders.
- It visually matches the existing application.

### Calculation

- User can select machine/material/cylinder.
- User can enter product dimensions.
- User can configure gaps/bleed where supported.
- System calculates across count.
- System calculates production quantity.
- System calculates material usage/waste where supported.
- Cylinder technical information is displayed.
- Invalid configurations produce warnings.

### SVG

- SVG is generated from structured calculation data.
- SVG is vector-based.
- Web width is visible.
- Products are visible.
- Across count is visible.
- Machine direction is visible.
- Repeat boundary is visible.
- Relevant dimensions are visible.
- Technical cylinder/repeat information is available.
- Preview does not render the entire production quantity.

### Export

- SVG can be downloaded.
- PDF can be generated.
- Existing Print Spec can include Flexo information.

### Architecture

- Existing Offset Layout remains functional.
- Flexo calculation is independent from Offset calculation.
- SVG is not the source of truth.
- Calculation can be reproduced from stored data.
- Existing Audit Trail is used for significant changes.

---

# 38. Final Design Principle

Build Flexo as a **parametric technical calculation engine**, not as a generic drawing editor.

The core should be:

```text
ORDER
  ↓
FLEXO SPECIFICATION
  ↓
CYLINDER / GEAR DATA
  ↓
LAYOUT CALCULATION
  ↓
STRUCTURED RESULT
  ↓
SVG TECHNICAL PREVIEW
  ↓
SVG / PDF / PRINT SPEC
```

The SVG should visually prove the calculation, not replace it.

The primary objective is to help a production/prepress user answer:

> "With this material, product, machine, cylinder and quantity, exactly how will the Flexo repeat be arranged, how many will fit across, what is the repeat, and what will production consumption/yield look like?"

Implement this feature into the **existing PrintGoo system**, preserving existing architecture and UI patterns wherever possible.
