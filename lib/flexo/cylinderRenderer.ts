import { FlexoLayoutResult, FlexoRenderOptions } from "./types";

interface RenderOrderMeta {
  docNo?: string;
  orderName?: string;
  customer?: string;
  productName?: string;
}

/**
 * Renders a realistic 3D-styled SVG preview of the flexographic printing cylinder roller,
 * complete with drive gear, chrome shafts, mounted photopolymer plate, and wrapped labels
 * projected dynamically according to cylinder rotation.
 */
export function renderFlexoCylinderSVG(
  result: FlexoLayoutResult,
  options: FlexoRenderOptions,
  meta: RenderOrderMeta = {}
): string {
  const rotationDeg = options.cylinderRotation || 0;
  const rotationRad = (rotationDeg * Math.PI) / 180;

  // Physical cylinder dimensions
  const cylDiameter = Math.max(30, result.cylinderDiameter);
  const cylRadius = cylDiameter / 2;
  const repeatLength = Math.max(50, result.printingLength);

  // Cylinder face width (axial width) - proportional to web width
  const webWidth = Math.max(25, result.webWidth);
  const barrelFaceWidth = Math.max(120, Math.min(240, webWidth * 1.5 + 40));
  const shaftWidth = 35;
  const gearWidth = 24;

  // SVG canvas dimensions
  const padX = 50;
  const padY = 55;
  const svgWidth = barrelFaceWidth + shaftWidth * 2 + gearWidth + padX * 2;
  const svgHeight = cylDiameter * 2.2 + padY * 2;

  const barrelX = padX + shaftWidth + gearWidth;
  const barrelY = padY + (svgHeight - padY * 2 - cylDiameter) / 2;
  const cylCenterY = barrelY + cylRadius;

  // Scale factor to map web width onto barrel face
  const webScale = Math.min(1.2, (barrelFaceWidth - 30) / webWidth);
  const actualWebW = webWidth * webScale;
  const webStartX = barrelX + (barrelFaceWidth - actualWebW) / 2;

  // Color separation styling
  const activeColor = options.activeColorSeparation || "all";
  let plateColor = "rgba(59, 130, 246, 0.25)";
  let plateBorder = "#3b82f6";
  let labelFill = "#ffffff";
  let labelStroke = "#2563eb";

  if (activeColor === "Cyan") {
    plateColor = "rgba(6, 182, 212, 0.3)";
    plateBorder = "#0891b2";
    labelStroke = "#06b6d4";
  } else if (activeColor === "Magenta") {
    plateColor = "rgba(236, 72, 153, 0.3)";
    plateBorder = "#db2777";
    labelStroke = "#ec4899";
  } else if (activeColor === "Yellow") {
    plateColor = "rgba(234, 179, 8, 0.3)";
    plateBorder = "#ca8a04";
    labelStroke = "#eab308";
  } else if (activeColor === "Black") {
    plateColor = "rgba(39, 39, 42, 0.35)";
    plateBorder = "#18181b";
    labelStroke = "#27272a";
  }

  const svgParts: string[] = [];

  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background:#0f172a; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">
  <defs>
    <!-- Metallic Cylinder Barrel Shading Gradient -->
    <linearGradient id="cylinderMetallic" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="12%" stop-color="#64748b" />
      <stop offset="35%" stop-color="#94a3b8" />
      <stop offset="50%" stop-color="#f8fafc" />
      <stop offset="68%" stop-color="#cbd5e1" />
      <stop offset="90%" stop-color="#475569" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>

    <!-- Chrome Shaft Gradient -->
    <linearGradient id="shaftChrome" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="25%" stop-color="#94a3b8" />
      <stop offset="48%" stop-color="#ffffff" />
      <stop offset="75%" stop-color="#64748b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>

    <!-- Gear Bronze / Steel Gradient -->
    <linearGradient id="gearGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#78350f" />
      <stop offset="20%" stop-color="#b45309" />
      <stop offset="45%" stop-color="#fde68a" />
      <stop offset="70%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#451a03" />
    </linearGradient>

    <!-- Shadow under roller -->
    <radialGradient id="rollerShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
`);

  // Background
  svgParts.push(`  <rect width="${svgWidth}" height="${svgHeight}" fill="#0f172a" />`);

  // 1. Top Technical Badge Bar
  const orderTitle = meta.docNo || "FLEXO-CYLINDER";
  svgParts.push(`
  <!-- Technical Info Header -->
  <g transform="translate(20, 16)">
    <text x="0" y="0" fill="#38bdf8" font-size="11" font-weight="700" letter-spacing="1">PRINTING CYLINDER 3D ROLLER INSPECTION</text>
    <text x="0" y="14" fill="#94a3b8" font-size="9">
      ${orderTitle} · Gear: <tspan fill="#f8fafc" font-weight="bold">${result.gearTeeth}T</tspan> | Diameter: <tspan fill="#f8fafc" font-weight="bold">Ø ${result.cylinderDiameter} mm</tspan> | Circumference: <tspan fill="#38bdf8" font-weight="bold">${result.printingLength} mm</tspan> | Plate: <tspan fill="#f8fafc">${result.plateThickness} mm</tspan>
    </text>
    <text x="${svgWidth - 40}" y="0" fill="#a5f3fc" font-size="9.5" font-weight="bold" text-anchor="end">
      Angle: ${Math.round(rotationDeg)}°
    </text>
    <text x="${svgWidth - 40}" y="14" fill="#64748b" font-size="8.5" text-anchor="end">
      Drag slider to rotate roller
    </text>
  </g>
`);

  // Shadow on floor under cylinder
  svgParts.push(`
  <ellipse cx="${barrelX + barrelFaceWidth / 2}" cy="${barrelY + cylDiameter + 24}" rx="${barrelFaceWidth * 0.55}" ry="12" fill="url(#rollerShadow)" />
`);

  // 2. Shafts (Left & Right)
  const shaftY = cylCenterY - cylRadius * 0.35;
  const shaftH = cylRadius * 0.7;

  // Left Shaft (between gear and left edge)
  svgParts.push(`
  <!-- Left Drive Shaft -->
  <rect x="${padX}" y="${shaftY}" width="${shaftWidth}" height="${shaftH}" rx="2" fill="url(#shaftChrome)" stroke="#475569" stroke-width="0.8" />
  <rect x="${padX + 4}" y="${shaftY - 4}" width="6" height="${shaftH + 8}" rx="1" fill="#334155" stroke="#64748b" stroke-width="0.5" />
`);

  // Right Idle Shaft
  const rightShaftX = barrelX + barrelFaceWidth;
  svgParts.push(`
  <!-- Right Idle Shaft -->
  <rect x="${rightShaftX}" y="${shaftY}" width="${shaftWidth + 10}" height="${shaftH}" rx="2" fill="url(#shaftChrome)" stroke="#475569" stroke-width="0.8" />
  <circle cx="${rightShaftX + shaftWidth}" cy="${cylCenterY}" r="${shaftH * 0.4}" fill="#334155" stroke="#94a3b8" stroke-width="0.6" />
`);

  // 3. Drive Spur Gear (Left Side)
  const gearX = padX + shaftWidth;
  const gearRadius = cylRadius * 1.08; // Gear slightly larger than cylinder (Pitch circle)
  const gearY = cylCenterY - gearRadius;
  const gearHeight = gearRadius * 2;

  svgParts.push(`
  <!-- Drive Gear (${result.gearTeeth}T) -->
  <g>
    <!-- Gear Rim & Teeth Pattern -->
    <rect x="${gearX}" y="${gearY}" width="${gearWidth}" height="${gearHeight}" rx="3" fill="url(#gearGradient)" stroke="#92400e" stroke-width="1" />
`);

  // Draw simulated gear teeth along circumference
  const numVisibleTeeth = 14;
  for (let i = 0; i < numVisibleTeeth; i++) {
    const tY = gearY + (gearHeight / numVisibleTeeth) * i;
    svgParts.push(`
    <line x1="${gearX - 1.5}" y1="${tY}" x2="${gearX + gearWidth + 1.5}" y2="${tY}" stroke="#451a03" stroke-width="0.8" />
    <rect x="${gearX - 2.5}" y="${tY - 1}" width="2.5" height="2" fill="#d97706" />
    <rect x="${gearX + gearWidth}" y="${tY - 1}" width="2.5" height="2" fill="#d97706" />
`);
  }

  // Gear hub ring
  svgParts.push(`
    <circle cx="${gearX + gearWidth / 2}" cy="${cylCenterY}" r="${cylRadius * 0.45}" fill="#1e293b" stroke="#f59e0b" stroke-width="0.8" />
    <text x="${gearX + gearWidth / 2}" y="${cylCenterY + 3}" fill="#fde68a" font-size="6.5" font-weight="bold" text-anchor="middle">${result.gearTeeth}T</text>
  </g>
`);

  // 4. Main Print Cylinder Barrel (Roller Body)
  svgParts.push(`
  <!-- Print Cylinder Body (Ø ${result.cylinderDiameter}mm) -->
  <g>
    <rect x="${barrelX}" y="${barrelY}" width="${barrelFaceWidth}" height="${cylDiameter}" rx="4" fill="url(#cylinderMetallic)" stroke="#64748b" stroke-width="1.2" />
    <!-- Metallic Highlights -->
    <line x1="${barrelX}" y1="${barrelY + cylDiameter * 0.25}" x2="${barrelX + barrelFaceWidth}" y2="${barrelY + cylDiameter * 0.25}" stroke="#ffffff" stroke-width="1.5" opacity="0.6" />
    <line x1="${barrelX}" y1="${barrelY + cylDiameter * 0.75}" x2="${barrelX + barrelFaceWidth}" y2="${barrelY + cylDiameter * 0.75}" stroke="#1e293b" stroke-width="1" opacity="0.5" />
  </g>
`);

  // 5. Mounted Photopolymer Plate Layer
  const plateX = webStartX - 2;
  const plateW = actualWebW + 4;
  svgParts.push(`
  <!-- Mounted Flexo Plate (${result.plateThickness}mm thickness) -->
  <rect x="${plateX}" y="${barrelY + 1}" width="${plateW}" height="${cylDiameter - 2}" fill="${plateColor}" stroke="${plateBorder}" stroke-width="1" opacity="0.85" />
`);

  // Plate mounting seam (where plate ends meet at repeat cycle)
  // Maps 0-repeat to cylinder angle
  const seamAngle = ((0 / repeatLength) * 2 * Math.PI + rotationRad) % (2 * Math.PI);
  const normSeamAngle = ((seamAngle + Math.PI) % (2 * Math.PI)) - Math.PI; // -PI to +PI
  if (Math.abs(normSeamAngle) < Math.PI / 2) {
    const seamY = cylCenterY - cylRadius * Math.sin(normSeamAngle);
    svgParts.push(`
  <!-- Plate Mounting Seam (Repeat Joint) -->
  <line x1="${plateX}" y1="${seamY}" x2="${plateX + plateW}" y2="${seamY}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3 2" />
  <rect x="${plateX + plateW / 2 - 35}" y="${seamY - 5}" width="70" height="10" rx="2" fill="#dc2626" />
  <text x="${plateX + plateW / 2}" y="${seamY + 2}" fill="#ffffff" font-size="5.5" font-weight="bold" text-anchor="middle">
    MOUNTING SEAM · 0 / ${result.printingLength}mm
  </text>
`);
  }

  // 6. Cylindrically Projected Labels on the Roller Face
  if (result.positions.length > 0 && result.acrossCount > 0 && result.aroundCount > 0) {
    svgParts.push(`  <!-- Wrapped Labels Projected on Curved Cylinder Surface -->`);

    // For each label on the repeat circumference
    for (const pos of result.positions) {
      // Label center along circumference (y in mm)
      const labelCenterY = pos.y + pos.height / 2;
      const labelFraction = labelCenterY / repeatLength; // 0 to 1
      const labelAngle = labelFraction * 2 * Math.PI + rotationRad;
      const normAngle = ((labelAngle + Math.PI) % (2 * Math.PI)) - Math.PI; // -PI to +PI

      // Visible if on front-facing hemisphere (-PI/2 < angle < +PI/2)
      if (Math.abs(normAngle) < (Math.PI / 2) * 0.95) {
        const cosAngle = Math.cos(normAngle); // Foreshortening factor
        const sinAngle = Math.sin(normAngle); // Vertical displacement factor

        // Projected Y coordinate on the cylinder canvas
        const projCenterY = cylCenterY - cylRadius * sinAngle;
        const projH = Math.max(3, pos.height * (cylDiameter / repeatLength) * 2.2 * cosAngle);
        const projY = projCenterY - projH / 2;

        // X coordinate along cylinder axis
        const projX = webStartX + pos.x * webScale;
        const projW = pos.width * webScale;

        // Lighting/shading based on angle
        const brightness = Math.max(0.4, cosAngle);
        const opacity = Math.max(0.3, cosAngle);

        svgParts.push(`
    <!-- Label Position ${pos.id} (Angle: ${(normAngle * 180 / Math.PI).toFixed(0)}°) -->
    <g opacity="${opacity.toFixed(2)}">
      <rect x="${projX}" y="${projY}" width="${projW}" height="${projH}" rx="1" fill="${labelFill}" stroke="${labelStroke}" stroke-width="1" />
      <!-- Cut outline -->
      <rect x="${projX + 1}" y="${projY + 1}" width="${Math.max(1, projW - 2)}" height="${Math.max(1, projH - 2)}" fill="none" stroke="#60a5fa" stroke-width="0.5" stroke-dasharray="1 1" />
`);

        // If projected height is large enough, render label text
        if (projH > 8 && projW > 12) {
          const fontSize = Math.max(4, Math.min(projW * 0.16, projH * 0.35, 8));
          svgParts.push(`
      <text x="${projX + projW / 2}" y="${projCenterY + fontSize * 0.35}" fill="#1e3a8a" font-size="${fontSize}" font-weight="bold" text-anchor="middle">
        ${pos.width}×${pos.height}
      </text>
`);
        }

        svgParts.push(`    </g>`);
      }
    }
  } else {
    // If across count is 0 or warning
    svgParts.push(`
    <rect x="${barrelX + 15}" y="${cylCenterY - 14}" width="${barrelFaceWidth - 30}" height="28" rx="4" fill="#7f1d1d" stroke="#ef4444" stroke-width="1" />
    <text x="${barrelX + barrelFaceWidth / 2}" y="${cylCenterY + 3}" fill="#fecaca" font-size="8.5" font-weight="bold" text-anchor="middle">
      ⚠️ Product exceeds web width (${result.productWidth}mm > ${result.webWidth}mm). Adjust in left panel.
    </text>
`);
  }

  // 7. Rotation Arrow & Cylinder Indicators
  const rotIndicatorY = barrelY + cylDiameter + 15;
  svgParts.push(`
  <!-- Rotation Direction Indicator -->
  <g transform="translate(${barrelX + barrelFaceWidth / 2}, ${rotIndicatorY})">
    <text x="0" y="0" fill="#38bdf8" font-size="7.5" font-weight="bold" text-anchor="middle" letter-spacing="1">
      ROTATION DIRECTION (PRESS RUN) &#x21bb;
    </text>
    <line x1="-35" y1="5" x2="35" y2="5" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="4 2" />
    <polygon points="35,5 29,2 29,8" fill="#0284c7" />
  </g>
`);

  // 8. Dimensional Technical Annotations
  if (options.showDimensions || options.view === "technical") {
    // Diameter Dimension Line (Right side)
    const dimX = rightShaftX + shaftWidth + 14;
    svgParts.push(`
  <!-- Diameter Annotation -->
  <g>
    <line x1="${barrelX + barrelFaceWidth}" y1="${barrelY}" x2="${dimX + 10}" y2="${barrelY}" stroke="#475569" stroke-width="0.8" stroke-dasharray="2 2" />
    <line x1="${barrelX + barrelFaceWidth}" y1="${barrelY + cylDiameter}" x2="${dimX + 10}" y2="${barrelY + cylDiameter}" stroke="#475569" stroke-width="0.8" stroke-dasharray="2 2" />
    <line x1="${dimX}" y1="${barrelY}" x2="${dimX}" y2="${barrelY + cylDiameter}" stroke="#94a3b8" stroke-width="0.8" />
    <polygon points="${dimX},${barrelY} ${dimX - 2.5},${barrelY + 5} ${dimX + 2.5},${barrelY + 5}" fill="#94a3b8" />
    <polygon points="${dimX},${barrelY + cylDiameter} ${dimX - 2.5},${barrelY + cylDiameter - 5} ${dimX + 2.5},${barrelY + cylDiameter - 5}" fill="#94a3b8" />
    <text x="${dimX + 4}" y="${cylCenterY + 3}" fill="#38bdf8" stroke="none" font-size="7.5" font-weight="bold">
      Ø ${result.cylinderDiameter}mm
    </text>
  </g>
`);

    // Web Width on Face Dimension Line (Top)
    svgParts.push(`
  <!-- Web Width Dimension Line -->
  <g transform="translate(0, ${barrelY - 14})">
    <line x1="${webStartX}" y1="2" x2="${webStartX}" y2="12" stroke="#475569" stroke-width="0.8" stroke-dasharray="2 2" />
    <line x1="${webStartX + actualWebW}" y1="2" x2="${webStartX + actualWebW}" y2="12" stroke="#475569" stroke-width="0.8" stroke-dasharray="2 2" />
    <line x1="${webStartX}" y1="5" x2="${webStartX + actualWebW}" y2="5" stroke="#94a3b8" stroke-width="0.8" />
    <polygon points="${webStartX},5 ${webStartX + 4},3 ${webStartX + 4},7" fill="#94a3b8" />
    <polygon points="${webStartX + actualWebW},5 ${webStartX + actualWebW - 4},3 ${webStartX + actualWebW - 4},7" fill="#94a3b8" />
    <text x="${webStartX + actualWebW / 2}" y="1" fill="#f8fafc" stroke="none" font-size="7.5" font-weight="bold" text-anchor="middle">
      WEB WIDTH: ${result.webWidth} mm
    </text>
  </g>
`);
  }

  svgParts.push(`</svg>`);
  return svgParts.join("\n");
}
