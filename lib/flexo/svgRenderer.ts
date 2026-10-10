import { FlexoLayoutResult, FlexoRenderOptions } from "./types";

interface RenderOrderMeta {
  docNo?: string;
  orderName?: string;
  customer?: string;
  productName?: string;
}

/**
 * Pure deterministic SVG renderer for Flexo layouts.
 * Generates valid, scalable, vector SVG string from structured FlexoLayoutResult.
 * Supports both Horizontal (standard press run) and Vertical web orientations.
 */
export function renderFlexoSVG(
  result: FlexoLayoutResult,
  options: FlexoRenderOptions,
  meta: RenderOrderMeta = {}
): string {
  const isHorizontal = options.displayOrientation !== "vertical"; // default to horizontal
  const repeats = options.repeatMode === "run" ? Math.max(2, Math.min(5, options.previewRepeats || 3)) : 1;
  const webWidth = Math.max(20, result.webWidth);
  const repeatLength = Math.max(30, result.printingLength);

  // Color separation filter
  const activeColor = options.activeColorSeparation || "all";
  let labelFill = "#eff6ff";
  let labelStroke = "#3b82f6";
  let bleedStroke = "#93c5fd";

  if (activeColor === "Cyan") {
    labelFill = "#ecfeff";
    labelStroke = "#06b6d4";
    bleedStroke = "#a5f3fc";
  } else if (activeColor === "Magenta") {
    labelFill = "#fdf2f8";
    labelStroke = "#db2777";
    bleedStroke = "#fbcfe8";
  } else if (activeColor === "Yellow") {
    labelFill = "#fefce8";
    labelStroke = "#eab308";
    bleedStroke = "#fef08a";
  } else if (activeColor === "Black") {
    labelFill = "#f4f4f5";
    labelStroke = "#18181b";
    bleedStroke = "#71717a";
  }

  const orderTitle = meta.docNo || "FLEXO-ORDER";
  const customerName = meta.customer ? `${meta.customer} · ` : "";
  const prodName = meta.productName || "Flexo Printed Label";

  if (isHorizontal) {
    // ─────────────────────────────────────────────────────────────
    // HORIZONTAL ORIENTATION (Machine Direction -> along X-axis)
    // ─────────────────────────────────────────────────────────────
    const totalWebLength = repeatLength * repeats;
    const padLeft = 45;
    const padRight = 55;
    const padTop = 88;
    const padBottom = options.showDimensions || options.view === "technical" ? 58 : 38;

    // Minimum width must easily accommodate the 3-column table with proper whitespace
    const svgWidth = Math.max(680, totalWebLength + padLeft + padRight);
    const svgHeight = webWidth + padTop + padBottom;

    const webX = padLeft;
    const webY = padTop;

    const svgParts: string[] = [];

    svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background:#ffffff; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">
  <defs>
    <marker id="arrow-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M 10 1 L 2 5 L 10 9 z" fill="#64748b" />
    </marker>
    <marker id="arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748b" />
    </marker>
    <pattern id="wasteHatchH" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1.2" />
    </pattern>
    <filter id="webShadowH" x="-1%" y="-2%" width="102%" height="104%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12" />
    </filter>
  </defs>
`);

    // Canvas background
    svgParts.push(`  <rect width="${svgWidth}" height="${svgHeight}" fill="#f8fafc" />`);

    // Technical Title Block Table (Engineering Spec Stamp with guaranteed whitespace)
    const headerTitleLeft = `${orderTitle}${meta.customer ? ` · ${meta.customer}` : ""}`;
    const truncatedLeft = headerTitleLeft.length > 36 ? headerTitleLeft.slice(0, 34) + "…" : headerTitleLeft;
    const truncatedMaterial = (result.materialName || "Material").length > 22 ? (result.materialName || "Material").slice(0, 20) + "…" : (result.materialName || "Material");

    const tableW = svgWidth - 30;
    const col1W = tableW * 0.36;
    const col2W = tableW * 0.34;
    const col3X = col1W + col2W;

    svgParts.push(`
  <!-- Technical Specification Title Table -->
  <g transform="translate(15, 8)">
    <rect width="${tableW}" height="42" fill="#ffffff" stroke="#334155" stroke-width="1.2" rx="1" />
    
    <!-- Table Grid Lines -->
    <line x1="0" y1="21" x2="${tableW}" y2="21" stroke="#cbd5e1" stroke-width="0.8" />
    <line x1="${col1W}" y1="0" x2="${col1W}" y2="42" stroke="#cbd5e1" stroke-width="0.8" />
    <line x1="${col3X}" y1="0" x2="${col3X}" y2="42" stroke="#cbd5e1" stroke-width="0.8" />

    <!-- Col 1: Order / Product -->
    <text x="10" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">ORDER &amp; CLIENT</text>
    <text x="10" y="18" fill="#0f172a" stroke="none" font-size="8" font-weight="700">${truncatedLeft}</text>
    <text x="10" y="30.5" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">SUBSTRATE &amp; WIDTH</text>
    <text x="10" y="38.5" fill="#0f172a" stroke="none" font-size="7.5" font-weight="600">${truncatedMaterial} · Web: ${result.webWidth}mm</text>

    <!-- Col 2: Cylinder / Tooling -->
    <text x="${col1W + 10}" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">CYLINDER &amp; GEAR</text>
    <text x="${col1W + 10}" y="18" fill="#0f172a" stroke="none" font-size="8" font-weight="700">${result.gearTeeth}T (Ø ${result.cylinderDiameter}mm) · PCD ${result.pitchCircleDiameter}mm</text>
    <text x="${col1W + 10}" y="30.5" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">REPEAT LENGTH</text>
    <text x="${col1W + 10}" y="38.5" fill="#0f172a" stroke="none" font-size="7.5" font-weight="600">Repeat: ${result.printingLength}mm · Plate: ${result.plateThickness}mm</text>

    <!-- Col 3: Layout Counts -->
    <text x="${col3X + 10}" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">IMPOSITION LAYOUT</text>
    <text x="${col3X + 10}" y="18" fill="#0284c7" stroke="none" font-size="8" font-weight="700">${result.aroundCount} Around × ${result.acrossCount} Across (${result.totalPerRepeat} pcs/rev)</text>
    <text x="${col3X + 10}" y="30.5" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">PRODUCT SIZE</text>
    <text x="${col3X + 10}" y="38.5" fill="#0f172a" stroke="none" font-size="7.5" font-weight="600">${result.productWidth} × ${result.productHeight} mm (${result.orientation})</text>
  </g>
`);

    // Machine Direction Indicator above web (well spaced below header)
    svgParts.push(`
  <!-- Machine Direction Indicator -->
  <g transform="translate(${webX}, 58)">
    <line x1="0" y1="0" x2="${totalWebLength}" y2="0" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="6 3" />
    <polygon points="${totalWebLength},0 ${totalWebLength - 6},-3.5 ${totalWebLength - 6},3.5" fill="#0284c7" />
    <rect x="${totalWebLength / 2 - 75}" y="-7" width="150" height="13" rx="2" fill="#f0f9ff" stroke="#bae6fd" stroke-width="0.75" />
    <text x="${totalWebLength / 2}" y="2.5" fill="#0369a1" font-size="6.5" font-weight="700" text-anchor="middle" letter-spacing="0.8">
      MACHINE DIRECTION (WEB FEED) &rarr;
    </text>
  </g>
`);

    // Web Substrate Rect
    svgParts.push(`
  <!-- Web Substrate -->
  <g transform="translate(${webX}, ${webY})">
    <rect x="0" y="0" width="${totalWebLength}" height="${webWidth}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" filter="url(#webShadowH)" />
`);

    // Side margins / trim waste along top and bottom edges of horizontal web
    if (result.sideMarginLeft > 0) {
      svgParts.push(`
    <rect x="0" y="0" width="${totalWebLength}" height="${result.sideMarginLeft}" fill="url(#wasteHatchH)" opacity="0.65" />
    <line x1="0" y1="${result.sideMarginLeft}" x2="${totalWebLength}" y2="${result.sideMarginLeft}" stroke="#94a3b8" stroke-width="0.75" stroke-dasharray="2 2" />
`);
    }
    if (result.sideMarginRight > 0) {
      svgParts.push(`
    <rect x="0" y="${webWidth - result.sideMarginRight}" width="${totalWebLength}" height="${result.sideMarginRight}" fill="url(#wasteHatchH)" opacity="0.65" />
    <line x1="0" y1="${webWidth - result.sideMarginRight}" x2="${totalWebLength}" y2="${webWidth - result.sideMarginRight}" stroke="#94a3b8" stroke-width="0.75" stroke-dasharray="2 2" />
`);
    }

    // Plate area (Prepress mode)
    if (options.showPlate || options.view === "plate") {
      const plateTop = Math.max(0, result.sideMarginLeft - 2);
      const plateHeight = Math.min(webWidth, result.usablePrintWidth + 4);
      for (let r = 0; r < repeats; r++) {
        const pX = r * repeatLength;
        svgParts.push(`
    <!-- Plate Boundary Cycle ${r + 1} -->
    <rect x="${pX + 1}" y="${plateTop}" width="${repeatLength - 2}" height="${plateHeight}" fill="none" stroke="#6366f1" stroke-width="1" stroke-dasharray="5 3" />
    <text x="${pX + 4}" y="${plateTop + 8}" fill="#6366f1" font-size="6" font-weight="600">PLATE ${result.gearTeeth}T (t=${result.plateThickness}mm)</text>
`);
      }
    }

    // Placed products or Warning if acrossCount === 0
    if (result.acrossCount > 0 && result.aroundCount > 0 && result.positions.length > 0) {
      for (let r = 0; r < repeats; r++) {
        const cycleOffsetX = r * repeatLength;

        svgParts.push(`    <g transform="translate(${cycleOffsetX}, 0)">`);

        for (const pos of result.positions) {
          const cutX = pos.y;
          const cutY = pos.x;
          const cutW = pos.height;
          const cutH = pos.width;

          const bleedX = pos.bleedY || 0;
          const bleedY = pos.bleedX || 0;

          // Bleed rect
          if (bleedX > 0 || bleedY > 0) {
            svgParts.push(`
      <rect x="${cutX - bleedX}" y="${cutY - bleedY}" width="${cutW + bleedX * 2}" height="${cutH + bleedY * 2}" fill="${labelFill}" stroke="${bleedStroke}" stroke-width="0.6" stroke-dasharray="1.5 1.5" />
`);
          }

          // Cut rect
          svgParts.push(`
      <rect x="${cutX}" y="${cutY}" width="${cutW}" height="${cutH}" fill="${labelFill}" stroke="${labelStroke}" stroke-width="1.2" rx="1" />
`);

          // Text inside label:
          // Check if label text is rotated or if vertical aspect ratio is better suited
          const labelTitle = meta.productName ? meta.productName.slice(0, 16) : "LABEL";
          const centerX = cutX + cutW / 2;
          const centerY = cutY + cutH / 2;

          // If label width on web is wide and height is narrow (e.g. 50mm across, 120mm feed):
          // In standard flexo feed, text runs naturally along feed or across.
          // If rotated orientation selected, rotate text 90 deg so it reads upright!
          if (result.orientation === "rotated") {
            const fontSize = Math.max(4.5, Math.min(cutH * 0.16, cutW * 0.25, 8.5));
            svgParts.push(`
      <g transform="translate(${centerX}, ${centerY}) rotate(90)">
        <text x="0" y="${-1}" fill="#1e40af" font-size="${fontSize}" font-weight="700" text-anchor="middle">
          ${labelTitle}
        </text>
        <text x="0" y="${fontSize * 1.0}" fill="#64748b" font-size="${Math.max(4, fontSize * 0.75)}" text-anchor="middle">
          ${pos.width} &times; ${pos.height} mm
        </text>
      </g>
`);
          } else {
            const fontSize = Math.max(4.5, Math.min(cutW * 0.16, cutH * 0.25, 8.5));
            svgParts.push(`
      <text x="${centerX}" y="${centerY - 1}" fill="#1e40af" font-size="${fontSize}" font-weight="700" text-anchor="middle">
        ${labelTitle}
      </text>
      <text x="${centerX}" y="${centerY + fontSize * 0.9}" fill="#64748b" font-size="${Math.max(4, fontSize * 0.75)}" text-anchor="middle">
        ${pos.width} &times; ${pos.height} mm
      </text>
`);
          }

          if (options.view === "technical") {
            svgParts.push(`
      <circle cx="${cutX}" cy="${cutY}" r="0.7" fill="#3b82f6" />
      <circle cx="${cutX + cutW}" cy="${cutY}" r="0.7" fill="#3b82f6" />
      <circle cx="${cutX}" cy="${cutY + cutH}" r="0.7" fill="#3b82f6" />
      <circle cx="${cutX + cutW}" cy="${cutY + cutH}" r="0.7" fill="#3b82f6" />
`);
          }
        }

        svgParts.push(`    </g>`);
      }
    } else {
      // Across count is 0 - prominent explanatory warning
      const warnW = Math.min(220, totalWebLength - 20);
      const warnH = Math.min(webWidth - 6, 36);
      svgParts.push(`
    <!-- Product Exceeds Web Width Warning Overlay -->
    <rect x="${(totalWebLength - warnW) / 2}" y="${(webWidth - warnH) / 2}" width="${warnW}" height="${warnH}" rx="4" fill="#fef2f2" stroke="#ef4444" stroke-width="1.2" />
    <text x="${totalWebLength / 2}" y="${webWidth / 2 - 3}" fill="#dc2626" font-size="8" font-weight="bold" text-anchor="middle">
      ⚠️ PRODUCT EXCEEDS USABLE WEB WIDTH
    </text>
    <text x="${totalWebLength / 2}" y="${webWidth / 2 + 7}" fill="#7f1d1d" font-size="6.5" text-anchor="middle">
      Product: ${result.productWidth}mm (+bleed ${(result.bleedX || 0) * 2}mm) &gt; Usable: ${result.usablePrintWidth}mm (Web: ${result.webWidth}mm).
    </text>
    <text x="${totalWebLength / 2}" y="${webWidth / 2 + 15}" fill="#2563eb" font-size="6" font-weight="600" text-anchor="middle">
      Increase Web Width (e.g. 50/60/100mm) or rotate product in left panel.
    </text>
`);
    }

    // Marks & Eye mark
    if (options.showMarks || options.view === "plate" || options.view === "technical") {
      for (let r = 0; r < repeats; r++) {
        const cycleOffsetX = r * repeatLength;
        svgParts.push(`    <g transform="translate(${cycleOffsetX}, 0)">`);

        for (const mark of result.marks) {
          if (mark.type === "eyemark") {
            svgParts.push(`
      <!-- Eye Mark -->
      <rect x="${mark.y}" y="${mark.x}" width="${mark.height}" height="${mark.width}" fill="${mark.color || "#09090b"}" stroke="#000" stroke-width="0.3" />
      <text x="${mark.y + mark.height / 2}" y="${mark.x + mark.width + 4}" fill="#475569" font-size="4" text-anchor="middle">EYE</text>
`);
          } else if (mark.type === "crosshair") {
            const cx = mark.y;
            const cy = mark.x;
            const rad = mark.width / 2;
            svgParts.push(`
      <circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="#09090b" stroke-width="0.4" />
      <line x1="${cx - rad - 1.5}" y1="${cy}" x2="${cx + rad + 1.5}" y2="${cy}" stroke="#09090b" stroke-width="0.4" />
      <line x1="${cx}" y1="${cy - rad - 1.5}" x2="${cx}" y2="${cy + rad + 1.5}" stroke="#09090b" stroke-width="0.4" />
`);
          } else if (mark.type === "colorbar") {
            svgParts.push(`
      <rect x="${mark.y}" y="${mark.x}" width="${mark.height}" height="${mark.width}" fill="${mark.color || "#000"}" stroke="#cbd5e1" stroke-width="0.25" />
      <text x="${mark.y + mark.height / 2}" y="${mark.x + mark.width - 0.7}" fill="#ffffff" font-size="3" font-weight="bold" text-anchor="middle">${mark.label || ""}</text>
`);
          }
        }

        svgParts.push(`    </g>`);
      }
    }

    // Repeat Boundary Lines
    for (let r = 1; r <= repeats; r++) {
      const bX = r * repeatLength;
      svgParts.push(`
    <!-- Repeat Cut Boundary Line (Repeat ${r}) -->
    <line x1="${bX}" y1="-4" x2="${bX}" y2="${webWidth + 14}" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="4 2.5" />
    <rect x="${bX - 44}" y="${webWidth + 5}" width="88" height="11" rx="2" fill="#fee2e2" stroke="#ef4444" stroke-width="0.7" />
    <text x="${bX}" y="${webWidth + 13}" fill="#b91c1c" font-size="5.5" font-weight="700" text-anchor="middle">
      REPEAT CUT · ${result.printingLength} mm (${result.gearTeeth}T)
    </text>
`);
    }

    svgParts.push(`  </g> <!-- End Web Substrate -->`);

    // Dimensions
    if (options.showDimensions || options.view === "technical") {
      svgParts.push(`
  <!-- Dimension Lines -->
  <g>
    <!-- Repeat Length Top Dimension Line -->
    <g transform="translate(${webX}, ${webY - 18})">
      <line x1="0" y1="3" x2="0" y2="15" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="${repeatLength}" y1="3" x2="${repeatLength}" y2="15" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="0" y1="6" x2="${repeatLength}" y2="6" stroke="#64748b" stroke-width="0.8" marker-start="url(#arrow-start)" marker-end="url(#arrow-end)" />
      <rect x="${repeatLength / 2 - 32}" y="0" width="64" height="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.5" rx="2" />
      <text x="${repeatLength / 2}" y="8.5" fill="#0f172a" stroke="none" font-size="6.5" font-weight="700" text-anchor="middle">
        REPEAT: ${result.printingLength} mm
      </text>
    </g>

    <!-- Web Width Left Dimension Line -->
    <g transform="translate(${webX - 22}, ${webY})">
      <line x1="4" y1="0" x2="18" y2="0" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="4" y1="${webWidth}" x2="18" y2="${webWidth}" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="8" y1="0" x2="8" y2="${webWidth}" stroke="#64748b" stroke-width="0.8" marker-start="url(#arrow-start)" marker-end="url(#arrow-end)" />
      <g transform="translate(4, ${webWidth / 2}) rotate(-90)">
        <rect x="-24" y="-6" width="48" height="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.5" rx="2" />
        <text x="0" y="2.5" fill="#0f172a" stroke="none" font-size="6.5" font-weight="700" text-anchor="middle">
          WEB: ${result.webWidth} mm
        </text>
      </g>
    </g>
  </g>
`);
    }

    // Technical view footer block
    if (options.view === "technical") {
      const techBoxY = svgHeight - 26;
      svgParts.push(`
  <!-- Technologist Parameter Block -->
  <g transform="translate(15, ${techBoxY})">
    <rect width="${svgWidth - 30}" height="20" rx="3" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.75" />
    <text x="12" y="13" fill="#334155" font-size="7" font-weight="600">
      CYLINDER: ${result.gearTeeth}T | Ø ${result.cylinderDiameter}mm | PCD: ${result.pitchCircleDiameter}mm | Film: ${result.filmLength}mm | Plate: ${result.plateThickness}mm | Util: ${result.yieldPercent}%
    </text>
    <text x="${svgWidth - 42}" y="13" fill="#64748b" font-size="6.5" font-weight="500" text-anchor="end">
      Used Web: ${result.usedWidth}mm | Side Waste: ${result.sideWasteWidth}mm | Yield: ${result.actualYieldQuantity.toLocaleString()} pcs
    </text>
  </g>
`);
    }

    svgParts.push(`</svg>`);
    return svgParts.join("\n");
  } else {
    // ─────────────────────────────────────────────────────────────
    // VERTICAL ORIENTATION (Web Feed Top -> Bottom)
    // ─────────────────────────────────────────────────────────────
    const totalWebHeight = repeatLength * repeats;
    const padLeft = options.showDimensions || options.view === "technical" ? 60 : 35;
    const padRight = options.showDimensions || options.view === "technical" ? 50 : 35;
    const padTop = 100; // Increased spacing for clear table and dimensions
    const padBottom = options.showDimensions || options.view === "technical" ? 45 : 30;

    // Minimum width must comfortably host the 3-column table
    const svgWidth = Math.max(680, webWidth + padLeft + padRight);
    const svgHeight = totalWebHeight + padTop + padBottom;

    const webX = (svgWidth - webWidth) / 2;
    const webY = padTop;

    const svgParts: string[] = [];

    svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background:#ffffff; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">
  <defs>
    <marker id="arrow-startV" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M 10 1 L 2 5 L 10 9 z" fill="#64748b" />
    </marker>
    <marker id="arrow-endV" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748b" />
    </marker>
    <pattern id="wasteHatchV" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1.2" />
    </pattern>
    <filter id="webShadowV" x="-2%" y="-1%" width="104%" height="102%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12" />
    </filter>
  </defs>
`);

    svgParts.push(`  <rect width="${svgWidth}" height="${svgHeight}" fill="#f8fafc" />`);

    // Technical Specification Title Table (Engineering Spec Stamp with whitespace)
    const vertHeaderLeft = `${orderTitle}${meta.customer ? ` · ${meta.customer}` : ""}`;
    const vertTruncated = vertHeaderLeft.length > 36 ? vertHeaderLeft.slice(0, 34) + "…" : vertHeaderLeft;
    const vertTruncatedMat = (result.materialName || "Material").length > 22 ? (result.materialName || "Material").slice(0, 20) + "…" : (result.materialName || "Material");

    const tableW = svgWidth - 30;
    const col1W = tableW * 0.36;
    const col2W = tableW * 0.34;
    const col3X = col1W + col2W;

    svgParts.push(`
  <!-- Technical Specification Title Table -->
  <g transform="translate(15, 8)">
    <rect width="${tableW}" height="42" fill="#ffffff" stroke="#334155" stroke-width="1.2" rx="1" />
    
    <!-- Table Grid Lines -->
    <line x1="0" y1="21" x2="${tableW}" y2="21" stroke="#cbd5e1" stroke-width="0.8" />
    <line x1="${col1W}" y1="0" x2="${col1W}" y2="42" stroke="#cbd5e1" stroke-width="0.8" />
    <line x1="${col3X}" y1="0" x2="${col3X}" y2="42" stroke="#cbd5e1" stroke-width="0.8" />

    <!-- Col 1: Order / Product -->
    <text x="10" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">ORDER &amp; CLIENT</text>
    <text x="10" y="18" fill="#0f172a" stroke="none" font-size="8" font-weight="700">${vertTruncated}</text>
    <text x="10" y="30.5" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">SUBSTRATE &amp; WIDTH</text>
    <text x="10" y="38.5" fill="#0f172a" stroke="none" font-size="7.5" font-weight="600">${vertTruncatedMat} · Web: ${result.webWidth}mm</text>

    <!-- Col 2: Cylinder / Tooling -->
    <text x="${col1W + 10}" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">CYLINDER &amp; GEAR</text>
    <text x="${col1W + 10}" y="18" fill="#0f172a" stroke="none" font-size="8" font-weight="700">${result.gearTeeth}T (Ø ${result.cylinderDiameter}mm) · PCD ${result.pitchCircleDiameter}mm</text>
    <text x="${col1W + 10}" y="30.5" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">REPEAT LENGTH</text>
    <text x="${col1W + 10}" y="38.5" fill="#0f172a" stroke="none" font-size="7.5" font-weight="600">Repeat: ${result.printingLength}mm · Plate: ${result.plateThickness}mm</text>

    <!-- Col 3: Layout Counts -->
    <text x="${col3X + 10}" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">IMPOSITION LAYOUT</text>
    <text x="${col3X + 10}" y="18" fill="#0284c7" stroke="none" font-size="8" font-weight="700">${result.aroundCount} Around × ${result.acrossCount} Across (${result.totalPerRepeat} pcs/rev)</text>
    <text x="${col3X + 10}" y="30.5" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">PRODUCT SIZE</text>
    <text x="${col3X + 10}" y="38.5" fill="#0f172a" stroke="none" font-size="7.5" font-weight="600">${result.productWidth} × ${result.productHeight} mm (${result.orientation})</text>
  </g>
`);

    // Machine direction vertical (well below table)
    svgParts.push(`
  <g transform="translate(${webX + webWidth / 2}, 60)">
    <line x1="0" y1="0" x2="0" y2="12" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="3 2" />
    <polygon points="0,14 -3,9 3,9" fill="#0284c7" />
    <text x="0" y="-3" fill="#0284c7" font-size="6.5" font-weight="700" text-anchor="middle" letter-spacing="0.8">
      MACHINE DIRECTION (FEED) &darr;
    </text>
  </g>
`);

    // Web Substrate
    svgParts.push(`
  <g transform="translate(${webX}, ${webY})">
    <rect x="0" y="0" width="${webWidth}" height="${totalWebHeight}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" filter="url(#webShadowV)" />
`);

    if (result.sideMarginLeft > 0) {
      svgParts.push(`
    <rect x="0" y="0" width="${result.sideMarginLeft}" height="${totalWebHeight}" fill="url(#wasteHatchV)" opacity="0.65" />
    <line x1="${result.sideMarginLeft}" y1="0" x2="${result.sideMarginLeft}" y2="${totalWebHeight}" stroke="#94a3b8" stroke-width="0.75" stroke-dasharray="2 2" />
`);
    }
    if (result.sideMarginRight > 0) {
      svgParts.push(`
    <rect x="${webWidth - result.sideMarginRight}" y="0" width="${result.sideMarginRight}" height="${totalWebHeight}" fill="url(#wasteHatchV)" opacity="0.65" />
    <line x1="${webWidth - result.sideMarginRight}" y1="0" x2="${webWidth - result.sideMarginRight}" y2="${totalWebHeight}" stroke="#94a3b8" stroke-width="0.75" stroke-dasharray="2 2" />
`);
    }

    if (result.acrossCount > 0 && result.aroundCount > 0 && result.positions.length > 0) {
      for (let r = 0; r < repeats; r++) {
        const cycleOffsetY = r * repeatLength;
        svgParts.push(`    <g transform="translate(0, ${cycleOffsetY})">`);

        for (const pos of result.positions) {
          const cutX = pos.x;
          const cutY = pos.y;
          const cutW = pos.width;
          const cutH = pos.height;
          const bleedX = pos.bleedX || 0;
          const bleedY = pos.bleedY || 0;

          if (bleedX > 0 || bleedY > 0) {
            svgParts.push(`
      <rect x="${cutX - bleedX}" y="${cutY - bleedY}" width="${cutW + bleedX * 2}" height="${cutH + bleedY * 2}" fill="${labelFill}" stroke="${bleedStroke}" stroke-width="0.6" stroke-dasharray="1.5 1.5" />
`);
          }

          svgParts.push(`
      <rect x="${cutX}" y="${cutY}" width="${cutW}" height="${cutH}" fill="${labelFill}" stroke="${labelStroke}" stroke-width="1.2" rx="1" />
`);

          const fontSize = Math.max(4.5, Math.min(cutW * 0.16, cutH * 0.22, 10));
          svgParts.push(`
      <text x="${cutX + cutW / 2}" y="${cutY + cutH / 2 - 1}" fill="#1e40af" font-size="${fontSize}" font-weight="700" text-anchor="middle">
        ${pos.width} &times; ${pos.height}
      </text>
`);
        }

        svgParts.push(`    </g>`);
      }
    } else {
      svgParts.push(`
    <rect x="2" y="${totalWebHeight / 2 - 18}" width="${webWidth - 4}" height="36" rx="3" fill="#fef2f2" stroke="#ef4444" stroke-width="1" />
    <text x="${webWidth / 2}" y="${totalWebHeight / 2 - 2}" fill="#dc2626" font-size="6.5" font-weight="bold" text-anchor="middle">
      ⚠️ EXCEEDS WEB
    </text>
    <text x="${webWidth / 2}" y="${totalWebHeight / 2 + 8}" fill="#7f1d1d" font-size="5.5" text-anchor="middle">
      Increase web width
    </text>
`);
    }

    // Repeat boundary lines
    for (let r = 1; r <= repeats; r++) {
      const bY = r * repeatLength;
      svgParts.push(`
    <!-- Repeat Cut Boundary Line (Cycle ${r}) -->
    <line x1="-8" y1="${bY}" x2="${webWidth + 8}" y2="${bY}" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="5 3" />
    <rect x="${webWidth / 2 - 42}" y="${bY + 2}" width="84" height="11" rx="2" fill="#fee2e2" stroke="#ef4444" stroke-width="0.7" />
    <text x="${webWidth / 2}" y="${bY + 9.5}" fill="#b91c1c" font-size="5.5" font-weight="700" text-anchor="middle">
      REPEAT CUT · ${result.printingLength} mm (${result.gearTeeth}T)
    </text>
`);
    }

    svgParts.push(`  </g>`);

    // Dimensions
    if (options.showDimensions || options.view === "technical") {
      svgParts.push(`
  <!-- Dimension Lines -->
  <g>
    <!-- Web Width Top Dimension Line (Placed well above feed arrow) -->
    <g transform="translate(${webX}, ${webY - 14})">
      <line x1="0" y1="2" x2="0" y2="12" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="${webWidth}" y1="2" x2="${webWidth}" y2="12" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="0" y1="5" x2="${webWidth}" y2="5" stroke="#64748b" stroke-width="0.8" marker-start="url(#arrow-startV)" marker-end="url(#arrow-endV)" />
      <rect x="${webWidth / 2 - 28}" y="-2" width="56" height="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.5" rx="2" />
      <text x="${webWidth / 2}" y="6" fill="#0f172a" stroke="none" font-size="6.5" font-weight="700" text-anchor="middle">
        WEB: ${result.webWidth} mm
      </text>
    </g>

    <!-- Repeat Length Left Dimension Line -->
    <g transform="translate(${webX - 25}, ${webY})">
      <line x1="2" y1="0" x2="16" y2="0" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="2" y1="${repeatLength}" x2="16" y2="${repeatLength}" stroke="#cbd5e1" stroke-width="0.6" />
      <line x1="6" y1="0" x2="6" y2="${repeatLength}" stroke="#64748b" stroke-width="0.8" marker-start="url(#arrow-startV)" marker-end="url(#arrow-endV)" />
      <g transform="translate(1, ${repeatLength / 2}) rotate(-90)">
        <rect x="-35" y="-6" width="70" height="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.5" rx="2" />
        <text x="0" y="2.5" fill="#0f172a" stroke="none" font-size="6.5" font-weight="700" text-anchor="middle">
          REPEAT: ${result.printingLength} mm
        </text>
      </g>
    </g>
  </g>
`);
    }

    svgParts.push(`</svg>`);
    return svgParts.join("\n");
  }
}
