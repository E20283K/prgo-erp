export interface SvgDimensions {
  width: number;
  height: number;
  unit?: string;
  source: "explicit_mm" | "explicit_converted" | "viewbox" | "path_bbox";
}

export interface ParsedSvgContour {
  pathD: string;
  viewBox: { x: number; y: number; width: number; height: number };
  computedBox?: { x: number; y: number; width: number; height: number };
  dimensions?: SvgDimensions;
  polygonVertices?: [number, number][];
}

/**
 * Extracts polygon vertices from SVG path 'd' if it consists of straight segments (M, L, H, V, Z).
 * Returns null if the path contains curves (C, S, Q, T, A).
 */
export function extractPolygonVertices(pathD: string): [number, number][] | null {
  if (!pathD || typeof pathD !== "string") return null;
  if (/[csqta]/i.test(pathD)) return null;

  const pts: [number, number][] = [];
  let curX = 0;
  let curY = 0;

  const commandRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = commandRegex.exec(pathD)) !== null) {
    const cmd = match[1];
    const argsStr = match[2].trim();
    const numMatches = argsStr.match(/[-+]?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi) || [];
    const nums = numMatches.map(Number);
    const isRel = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();

    if (type === "M" || type === "L") {
      for (let i = 0; i < nums.length - 1; i += 2) {
        curX = isRel ? curX + nums[i] : nums[i];
        curY = isRel ? curY + nums[i + 1] : nums[i + 1];
        pts.push([curX, curY]);
      }
    } else if (type === "H") {
      for (const val of nums) {
        curX = isRel ? curX + val : val;
        pts.push([curX, curY]);
      }
    } else if (type === "V") {
      for (const val of nums) {
        curY = isRel ? curY + val : val;
        pts.push([curX, curY]);
      }
    }
  }

  // Remove consecutive duplicates
  const cleanPts: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (cleanPts.length > 0) {
      const last = cleanPts[cleanPts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-4) continue;
    }
    cleanPts.push(p);
  }
  // Remove closing duplicate if it matches the first vertex
  if (cleanPts.length > 2) {
    const first = cleanPts[0];
    const last = cleanPts[cleanPts.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-4) {
      cleanPts.pop();
    }
  }

  return cleanPts.length >= 3 ? cleanPts : null;
}

/**
 * Computes parallel offset (buffer/inset) of a 2D polygon by distance dist.
 * dist > 0: outward buffer (Bleed)
 * dist < 0: inward inset (Safe Margin)
 * Every offset edge is strictly parallel to the original edge at Math.abs(dist).
 */
export function offsetPolygon(pts: [number, number][], dist: number): [number, number][] {
  const n = pts.length;
  if (n < 3 || dist === 0) return pts;

  // 1. Calculate signed area (clockwise check in SVG coordinates where Y goes down)
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  const isClockwise = area > 0;
  const sign = isClockwise ? 1 : -1;

  // 2. Compute outward unit normal for each edge
  const normals: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = pts[j][0] - pts[i][0];
    const dy = pts[j][1] - pts[i][1];
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      normals.push([0, 0]);
    } else {
      normals.push([(sign * dy) / len, (-sign * dx) / len]);
    }
  }

  // 3. Intersect shifted line (i-1) with shifted line (i)
  const newPts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const curr = i;

    const p1 = [pts[prev][0] + dist * normals[prev][0], pts[prev][1] + dist * normals[prev][1]];
    const d1 = [pts[curr][0] - pts[prev][0], pts[curr][1] - pts[prev][1]];

    const next = (curr + 1) % n;
    const p2 = [pts[curr][0] + dist * normals[curr][0], pts[curr][1] + dist * normals[curr][1]];
    const d2 = [pts[next][0] - pts[curr][0], pts[next][1] - pts[curr][1]];

    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(cross) < 1e-6) {
      newPts.push([p2[0], p2[1]]);
    } else {
      const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / cross;
      newPts.push([p1[0] + t * d1[0], p1[1] + t * d1[1]]);
    }
  }

  return newPts;
}

/**
 * Converts array of 2D points to an SVG path "d" string.
 */
export function polygonToPathD(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  return "M " + pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ") + " Z";
}

/**
 * Computes exact bounding box of an SVG path 'd' string considering
 * absolute/relative commands (M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z).
 */
export function getPathBoundingBox(pathD: string): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  let curX = 0;
  let curY = 0;

  const updateMinMax = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const commandRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = commandRegex.exec(pathD)) !== null) {
    const cmd = match[1];
    const argsStr = match[2].trim();
    // Match signed floats / ints
    const numMatches = argsStr.match(/[-+]?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi) || [];
    const nums = numMatches.map(Number);

    const isRelative = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();

    if (type === "H") {
      // Horizontal line
      for (const val of nums) {
        curX = isRelative ? curX + val : val;
        updateMinMax(curX, curY);
      }
    } else if (type === "V") {
      // Vertical line
      for (const val of nums) {
        curY = isRelative ? curY + val : val;
        updateMinMax(curX, curY);
      }
    } else if (type === "M" || type === "L" || type === "T") {
      for (let i = 0; i < nums.length - 1; i += 2) {
        curX = isRelative ? curX + nums[i] : nums[i];
        curY = isRelative ? curY + nums[i + 1] : nums[i + 1];
        updateMinMax(curX, curY);
      }
    } else if (type === "C") {
      // Cubic Bezier: x1 y1 x2 y2 x y
      for (let i = 0; i < nums.length - 5; i += 6) {
        const x1 = isRelative ? curX + nums[i] : nums[i];
        const y1 = isRelative ? curY + nums[i + 1] : nums[i + 1];
        const x2 = isRelative ? curX + nums[i + 2] : nums[i + 2];
        const y2 = isRelative ? curY + nums[i + 3] : nums[i + 3];
        const x = isRelative ? curX + nums[i + 4] : nums[i + 4];
        const y = isRelative ? curY + nums[i + 5] : nums[i + 5];

        updateMinMax(x1, y1);
        updateMinMax(x2, y2);
        updateMinMax(x, y);

        curX = x;
        curY = y;
      }
    } else if (type === "S" || type === "Q") {
      // Quad Bezier: x1 y1 x y
      for (let i = 0; i < nums.length - 3; i += 4) {
        const x1 = isRelative ? curX + nums[i] : nums[i];
        const y1 = isRelative ? curY + nums[i + 1] : nums[i + 1];
        const x = isRelative ? curX + nums[i + 2] : nums[i + 2];
        const y = isRelative ? curY + nums[i + 3] : nums[i + 3];

        updateMinMax(x1, y1);
        updateMinMax(x, y);

        curX = x;
        curY = y;
      }
    } else if (type === "A") {
      // Arc: rx ry x-axis-rotation large-arc-flag sweep-flag x y
      for (let i = 0; i < nums.length - 6; i += 7) {
        const x = isRelative ? curX + nums[i + 5] : nums[i + 5];
        const y = isRelative ? curY + nums[i + 6] : nums[i + 6];
        updateMinMax(x, y);
        curX = x;
        curY = y;
      }
    }
  }

  if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - minY),
  };
}

/**
 * Accurately extracts physical or viewBox dimensions from SVG content.
 * Handles mm, cm, in, pt, px and unitless viewBox/bounding box coordinates.
 */
export function extractSvgDimensions(svgContent: string): SvgDimensions | null {
  if (!svgContent || typeof svgContent !== "string") return null;
  const trimmed = svgContent.trim();
  if (!trimmed) return null;

  const roundDim = (val: number): number => {
    const rounded = Math.round(val * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
      return Math.round(rounded);
    }
    return rounded;
  };

  const convertToMm = (val: number, unit: string): number => {
    switch (unit.toLowerCase()) {
      case "mm":
        return val;
      case "cm":
        return val * 10;
      case "in":
        return val * 25.4;
      case "pt":
        return (val * 25.4) / 72;
      case "pc":
        return (val * 12 * 25.4) / 72;
      case "px":
        return (val * 25.4) / 96;
      default:
        return val;
    }
  };

  // 1. Try to read explicit width and height from <svg>
  const svgTagMatch = trimmed.match(/<svg\b([^>]*)>/i);
  let explicitWidth: { val: number; unit: string } | null = null;
  let explicitHeight: { val: number; unit: string } | null = null;

  if (svgTagMatch) {
    const attrs = svgTagMatch[1];
    const wMatch = attrs.match(/\bwidth=["']\s*([-\d.]+)\s*(mm|cm|in|pt|px|pc)?\s*["']/i);
    const hMatch = attrs.match(/\bheight=["']\s*([-\d.]+)\s*(mm|cm|in|pt|px|pc)?\s*["']/i);

    if (wMatch) {
      const v = parseFloat(wMatch[1]);
      if (!isNaN(v) && v > 0) explicitWidth = { val: v, unit: (wMatch[2] || "").toLowerCase() };
    }
    if (hMatch) {
      const v = parseFloat(hMatch[1]);
      if (!isNaN(v) && v > 0) explicitHeight = { val: v, unit: (hMatch[2] || "").toLowerCase() };
    }
  }

  // If explicit physical units (mm, cm, in) exist:
  if (explicitWidth && explicitHeight) {
    const wUnit = explicitWidth.unit;
    const hUnit = explicitHeight.unit;

    if (wUnit === "mm" || hUnit === "mm") {
      return {
        width: roundDim(convertToMm(explicitWidth.val, wUnit || "mm")),
        height: roundDim(convertToMm(explicitHeight.val, hUnit || "mm")),
        unit: "mm",
        source: "explicit_mm",
      };
    }

    if (wUnit === "cm" || wUnit === "in" || wUnit === "pt") {
      return {
        width: roundDim(convertToMm(explicitWidth.val, wUnit)),
        height: roundDim(convertToMm(explicitHeight.val, hUnit)),
        unit: wUnit,
        source: "explicit_converted",
      };
    }
  }

  // 2. Try viewBox
  let vb: { x: number; y: number; width: number; height: number } | null = null;
  const vbMatch = trimmed.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
  if (vbMatch) {
    const w = parseFloat(vbMatch[3]);
    const h = parseFloat(vbMatch[4]);
    if (w > 0 && h > 0) {
      vb = { x: parseFloat(vbMatch[1]), y: parseFloat(vbMatch[2]), width: w, height: h };
    }
  }

  if (vb) {
    // If explicit width in pt or px was given with viewBox
    if (explicitWidth && explicitHeight && (explicitWidth.unit === "px" || explicitWidth.unit === "pt")) {
      return {
        width: roundDim(convertToMm(explicitWidth.val, explicitWidth.unit)),
        height: roundDim(convertToMm(explicitHeight.val, explicitHeight.unit)),
        unit: explicitWidth.unit,
        source: "explicit_converted",
      };
    }

    // Check if viewBox values are Illustrator points (e.g. 141.732 => 50 mm)
    const asMmPtW = (vb.width * 25.4) / 72;
    const asMmPtH = (vb.height * 25.4) / 72;
    const isPtLikely =
      Math.abs(asMmPtW - Math.round(asMmPtW)) < 0.05 &&
      Math.abs(asMmPtH - Math.round(asMmPtH)) < 0.05 &&
      Math.abs(vb.width - Math.round(vb.width)) > 0.02;

    if (isPtLikely) {
      return {
        width: Math.round(asMmPtW),
        height: Math.round(asMmPtH),
        unit: "pt",
        source: "explicit_converted",
      };
    }

    return {
      width: roundDim(vb.width),
      height: roundDim(vb.height),
      unit: "mm",
      source: "viewbox",
    };
  }

  // 3. Fallback: Path bounding box
  const parsed = parseSvgContour(trimmed);
  if (parsed && parsed.viewBox.width > 0 && parsed.viewBox.height > 0) {
    return {
      width: roundDim(parsed.viewBox.width),
      height: roundDim(parsed.viewBox.height),
      unit: "mm",
      source: "path_bbox",
    };
  }

  return null;
}

/**
 * Extracts all contour paths and calculates exact viewBox.
 */
export function parseSvgContour(svgContent: string): ParsedSvgContour | null {
  if (!svgContent || typeof svgContent !== "string") return null;
  const trimmed = svgContent.trim();
  if (!trimmed) return null;

  let explicitViewBox: { x: number; y: number; width: number; height: number } | null = null;
  let collectedPaths: string[] = [];

  // 1. Check if it's an XML/SVG structure
  if (trimmed.includes("<svg") || trimmed.includes("<path") || trimmed.includes("<polygon") || trimmed.includes("<rect")) {
    const vbMatch = trimmed.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
    if (vbMatch) {
      explicitViewBox = {
        x: parseFloat(vbMatch[1]),
        y: parseFloat(vbMatch[2]),
        width: parseFloat(vbMatch[3]),
        height: parseFloat(vbMatch[4]),
      };
    } else {
      const wMatch = trimmed.match(/<svg[^>]*\bwidth=["']\s*([\d.]+)(?:px|mm)?\s*["']/i);
      const hMatch = trimmed.match(/<svg[^>]*\bheight=["']\s*([\d.]+)(?:px|mm)?\s*["']/i);
      if (wMatch && hMatch) {
        explicitViewBox = {
          x: 0,
          y: 0,
          width: parseFloat(wMatch[1]),
          height: parseFloat(hMatch[1]),
        };
      }
    }

    // Extract all <path d="...">
    const pathMatches = Array.from(trimmed.matchAll(/<path[^>]*\bd=["']([^"']+)["']/gi));
    for (const pm of pathMatches) {
      if (pm[1]?.trim()) {
        collectedPaths.push(pm[1].trim());
      }
    }

    // Extract <polygon points="...">
    const polyMatches = Array.from(trimmed.matchAll(/<polygon[^>]*\bpoints=["']([^"']+)["']/gi));
    for (const poly of polyMatches) {
      const pts = poly[1].trim().split(/[\s,]+/);
      if (pts.length >= 4) {
        const polyD = `M ${pts[0]} ${pts[1]}` + pts.slice(2).reduce((acc, val, idx) => {
          return idx % 2 === 0 ? `${acc} L ${val}` : `${acc} ${val}`;
        }, "") + " Z";
        collectedPaths.push(polyD);
      }
    }

    // Extract <rect ...>
    const rectMatches = Array.from(trimmed.matchAll(/<rect[^>]*\bwidth=["']([\d.]+)["'][^>]*\bheight=["']([\d.]+)["'][^>]*>/gi));
    for (const rm of rectMatches) {
      const w = parseFloat(rm[1]);
      const h = parseFloat(rm[2]);
      if (w > 0 && h > 0) {
        collectedPaths.push(`M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`);
      }
    }

    // Extract <circle ...>
    const circleMatches = Array.from(trimmed.matchAll(/<circle[^>]*\bcx=["']([-\d.]+)["'][^>]*\bcy=["']([-\d.]+)["'][^>]*\br=["']([-\d.]+)["']/gi));
    for (const cm of circleMatches) {
      const cx = parseFloat(cm[1]);
      const cy = parseFloat(cm[2]);
      const r = parseFloat(cm[3]);
      if (r > 0) {
        collectedPaths.push(`M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`);
      }
    }

    // Extract <ellipse ...>
    const ellipseMatches = Array.from(trimmed.matchAll(/<ellipse[^>]*\bcx=["']([-\d.]+)["'][^>]*\bcy=["']([-\d.]+)["'][^>]*\brx=["']([-\d.]+)["'][^>]*\bry=["']([-\d.]+)["']/gi));
    for (const em of ellipseMatches) {
      const cx = parseFloat(em[1]);
      const cy = parseFloat(em[2]);
      const rx = parseFloat(em[3]);
      const ry = parseFloat(em[4]);
      if (rx > 0 && ry > 0) {
        collectedPaths.push(`M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`);
      }
    }

    // Extract <polyline ...>
    const polylineMatches = Array.from(trimmed.matchAll(/<polyline[^>]*\bpoints=["']([^"']+)["']/gi));
    for (const pl of polylineMatches) {
      const pts = pl[1].trim().split(/[\s,]+/);
      if (pts.length >= 4) {
        const plD = `M ${pts[0]} ${pts[1]}` + pts.slice(2).reduce((acc, val, idx) => {
          return idx % 2 === 0 ? `${acc} L ${val}` : `${acc} ${val}`;
        }, "");
        collectedPaths.push(plD);
      }
    }

    // Extract <line ...>
    const lineMatches = Array.from(trimmed.matchAll(/<line[^>]*\bx1=["']([-\d.]+)["'][^>]*\by1=["']([-\d.]+)["'][^>]*\bx2=["']([-\d.]+)["'][^>]*\by2=["']([-\d.]+)["']/gi));
    for (const lm of lineMatches) {
      collectedPaths.push(`M ${lm[1]} ${lm[2]} L ${lm[3]} ${lm[4]}`);
    }
  } else {
    // Pure raw path "d" string
    collectedPaths.push(trimmed);
  }

  if (collectedPaths.length === 0) return null;

  const combinedPathD = collectedPaths.join(" ");

  // Calculate actual bounding box from path geometry
  const computedBox = getPathBoundingBox(combinedPathD);

  // If explicit viewBox was provided and is valid, use it; otherwise use computed path bounding box
  const finalViewBox = explicitViewBox && explicitViewBox.width > 0 && explicitViewBox.height > 0
    ? explicitViewBox
    : computedBox;

  const dimensions = extractSvgDimensions(trimmed) || undefined;
  const polygonVertices = extractPolygonVertices(combinedPathD) || undefined;

  return {
    pathD: combinedPathD,
    viewBox: finalViewBox,
    computedBox,
    dimensions,
    polygonVertices,
  };
}
