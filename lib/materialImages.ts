/**
 * PrintGoo ERP — Printing Material Image System
 * Generates and resolves high-fidelity graphical material images for:
 * 1) Paper & Board (Silk, Gloss, Kraft, Cardboard, Colorplan, Offset)
 * 2) Inks & Plates (CMYK Inks, Spot Inks, CTP Thermal Plates)
 * 3) Foil & Film (Lamination Film, Gold Foil, Holographic Foil)
 * 4) Adhesives & Binding (PUR Glue, Stitching Wire, Thread Cones)
 * 5) Roll & Label (Satin Ribbon, Nylon Taffeta, Woven Labels)
 * 6) Offcuts & Scraps (Delovoy Otxod sheets with cut markers)
 *
 * Guaranteed 100% offline-ready, zero-CORS SVG Data URIs with rich gradients,
 * plus optional support for custom external photographic URLs.
 */

function createSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// ─── Procedural Realistic Material SVGs ───────────────────────────────────────

/** 1. Coated Silk / Gloss Art Paper */
export const SVG_PAPER_SILK = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#bgGrad)"/>
  <!-- Paper stack layer 3 -->
  <rect x="36" y="44" width="88" height="76" rx="4" fill="#cbd5e1" opacity="0.6"/>
  <!-- Paper stack layer 2 -->
  <rect x="32" y="40" width="88" height="76" rx="4" fill="#e2e8f0" opacity="0.8"/>
  <!-- Top paper sheet -->
  <rect x="28" y="34" width="88" height="76" rx="4" fill="url(#sheetGrad)" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  <!-- Subtle sheet curl / shine -->
  <path d="M 28 42 L 56 34 L 116 34 L 116 44 Z" fill="#ffffff" opacity="0.6"/>
  <!-- Grid lines representing paper grammage / layout -->
  <line x1="40" y1="52" x2="104" y2="52" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="3,3"/>
  <line x1="40" y1="64" x2="104" y2="64" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="3,3"/>
  <line x1="40" y1="76" x2="104" y2="76" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="3,3"/>
  <!-- Badge -->
  <rect x="34" y="88" width="56" height="14" rx="3" fill="#2563eb" opacity="0.9"/>
  <text x="62" y="98" fill="#ffffff" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">150g SILK</text>
  <circle cx="106" cy="95" r="4" fill="#10b981"/>
</svg>
`);

/** 2. Coated Heavy Cardboard / Duplex Board */
export const SVG_CARDBOARD = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="crdBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fdf4ff"/>
      <stop offset="100%" stop-color="#f3e8ff"/>
    </linearGradient>
    <linearGradient id="boardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#crdBg)"/>
  <!-- Thick board isometric layers -->
  <rect x="32" y="52" width="96" height="64" rx="4" fill="#a855f7" opacity="0.3"/>
  <rect x="30" y="46" width="96" height="64" rx="4" fill="#cbd5e1"/>
  <!-- Fluting pattern / multi-ply edge -->
  <path d="M 30 102 L 126 102 L 126 110 L 30 110 Z" fill="#64748b"/>
  <!-- Top white coated surface -->
  <rect x="28" y="38" width="96" height="64" rx="4" fill="url(#boardGrad)" stroke="#9333ea" stroke-width="1.5"/>
  <rect x="36" y="48" width="80" height="44" rx="2" fill="#faf5ff" stroke="#e9d5ff" stroke-width="1"/>
  <!-- Box die-line hint -->
  <rect x="44" y="54" width="36" height="24" fill="none" stroke="#a855f7" stroke-width="1" stroke-dasharray="2,2"/>
  <rect x="36" y="86" width="60" height="14" rx="3" fill="#9333ea"/>
  <text x="66" y="96" fill="#ffffff" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">300g BOARD</text>
</svg>
`);

/** 3. Kraft Paper & Kraft Board */
export const SVG_KRAFT = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="kraftBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef3c7"/>
      <stop offset="100%" stop-color="#fde68a"/>
    </linearGradient>
    <linearGradient id="kraftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#kraftBg)"/>
  <!-- Stack shadows -->
  <rect x="34" y="46" width="92" height="74" rx="4" fill="#92400e" opacity="0.4"/>
  <rect x="30" y="42" width="92" height="74" rx="4" fill="#b45309" opacity="0.6"/>
  <!-- Top kraft sheet -->
  <rect x="26" y="36" width="92" height="74" rx="4" fill="#c27803" stroke="#78350f" stroke-width="1.5"/>
  <!-- Natural kraft fiber specks -->
  <circle cx="45" cy="50" r="1.5" fill="#78350f" opacity="0.4"/>
  <circle cx="85" cy="45" r="1" fill="#78350f" opacity="0.3"/>
  <circle cx="100" cy="70" r="1.5" fill="#78350f" opacity="0.4"/>
  <circle cx="55" cy="80" r="1" fill="#78350f" opacity="0.3"/>
  <circle cx="75" cy="65" r="1.2" fill="#78350f" opacity="0.5"/>
  <!-- Badge -->
  <rect x="34" y="88" width="60" height="14" rx="3" fill="#78350f"/>
  <text x="64" y="98" fill="#fef3c7" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">350g KRAFT</text>
  <!-- Recycle emblem hint -->
  <circle cx="106" cy="95" r="5" fill="#15803d"/>
  <text x="106" y="98" fill="#ffffff" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle">♻</text>
</svg>
`);

/** 4. Colorplan Ebony (Luxury Black Designer Paper) */
export const SVG_COLORPLAN_EBONY = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="darkBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="blackSheet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#darkBg)"/>
  <!-- Stack -->
  <rect x="32" y="44" width="92" height="74" rx="4" fill="#000000" opacity="0.8"/>
  <rect x="28" y="38" width="92" height="74" rx="4" fill="url(#blackSheet)" stroke="#475569" stroke-width="1.5"/>
  <!-- Gold foil stamped accent line -->
  <line x1="40" y1="55" x2="108" y2="55" stroke="#f59e0b" stroke-width="1.5"/>
  <rect x="40" y="62" width="45" height="12" fill="#0f172a" stroke="#d97706" stroke-width="0.8"/>
  <text x="62" y="71" fill="#fbbf24" font-size="6" font-family="sans-serif" font-weight="bold" text-anchor="middle">COLORPLAN</text>
  <rect x="36" y="88" width="60" height="14" rx="3" fill="#0f172a" stroke="#d97706" stroke-width="1"/>
  <text x="66" y="98" fill="#fbbf24" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">270g EBONY</text>
</svg>
`);

/** 5. Process CMYK Printing Ink */
export const SVG_INK_CMYK = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="inkBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#inkBg)"/>
  <!-- Cyan Ink Pot -->
  <circle cx="55" cy="55" r="22" fill="#06b6d4" stroke="#ffffff" stroke-width="2"/>
  <circle cx="55" cy="55" r="14" fill="#0891b2"/>
  <text x="55" y="59" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold" text-anchor="middle">C</text>
  <!-- Magenta Ink Pot -->
  <circle cx="105" cy="55" r="22" fill="#ec4899" stroke="#ffffff" stroke-width="2"/>
  <circle cx="105" cy="55" r="14" fill="#db2777"/>
  <text x="105" y="59" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold" text-anchor="middle">M</text>
  <!-- Yellow Ink Pot -->
  <circle cx="55" cy="105" r="22" fill="#eab308" stroke="#ffffff" stroke-width="2"/>
  <circle cx="55" cy="105" r="14" fill="#ca8a04"/>
  <text x="55" y="109" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold" text-anchor="middle">Y</text>
  <!-- Black Ink Pot -->
  <circle cx="105" cy="105" r="22" fill="#18181b" stroke="#ffffff" stroke-width="2"/>
  <circle cx="105" cy="105" r="14" fill="#27272a"/>
  <text x="105" y="109" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold" text-anchor="middle">K</text>
</svg>
`);

/** 6. Pantone Spot Color / Specialty Ink */
export const SVG_INK_PANTONE = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="pmsBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff1f2"/>
      <stop offset="100%" stop-color="#ffe4e6"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#pmsBg)"/>
  <!-- Ink Tin Can -->
  <ellipse cx="80" cy="120" rx="46" ry="14" fill="#e11d48" opacity="0.3"/>
  <path d="M 34 60 L 34 110 C 34 122 126 122 126 110 L 126 60 Z" fill="#e11d48"/>
  <ellipse cx="80" cy="60" rx="46" ry="14" fill="#f43f5e" stroke="#fda4af" stroke-width="2"/>
  <ellipse cx="80" cy="58" rx="36" ry="9" fill="#be123c"/>
  <!-- Paint swirl -->
  <path d="M 60 56 Q 80 62 100 56" stroke="#fda4af" stroke-width="2" fill="none"/>
  <!-- Label on tin -->
  <rect x="48" y="78" width="64" height="24" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="80" y="89" fill="#0f172a" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle">PANTONE®</text>
  <text x="80" y="98" fill="#e11d48" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">SPOT RED</text>
</svg>
`);

/** 7. CTP Thermal Offset Plates */
export const SVG_CTP_PLATE = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="metalBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="plateFace" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#metalBg)"/>
  <!-- Plate Aluminum Backing -->
  <rect x="22" y="24" width="116" height="112" rx="4" fill="#cbd5e1" stroke="#64748b" stroke-width="2"/>
  <!-- Blue Photosensitive Emulsion Coating -->
  <rect x="28" y="34" width="104" height="96" rx="2" fill="url(#plateFace)"/>
  <!-- Registration Pin Holes (Heidelberg/Bacher standard 425mm) -->
  <circle cx="50" cy="29" r="2.5" fill="#334155"/>
  <circle cx="80" cy="29" r="2.5" fill="#334155"/>
  <circle cx="110" cy="29" r="2.5" fill="#334155"/>
  <!-- Imaged halftone illustration on plate -->
  <rect x="36" y="44" width="40" height="36" fill="#38bdf8" opacity="0.8"/>
  <rect x="82" y="44" width="40" height="36" fill="#0284c7" stroke="#38bdf8" stroke-width="1"/>
  <rect x="36" y="86" width="86" height="20" fill="#075985" opacity="0.6"/>
  <!-- Plate Spec Badge -->
  <rect x="36" y="110" width="86" height="14" rx="2" fill="#0f172a" opacity="0.85"/>
  <text x="79" y="120" fill="#38bdf8" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">CTP 1030×790</text>
</svg>
`);

/** 8. Soft-Touch Matte / Gloss Lamination Film */
export const SVG_FILM_ROLL = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="filmBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0fdf4"/>
      <stop offset="100%" stop-color="#dcfce7"/>
    </linearGradient>
    <linearGradient id="rollGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="50%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#filmBg)"/>
  <!-- Roll Core & Winding -->
  <ellipse cx="44" cy="80" rx="14" ry="34" fill="#047857"/>
  <ellipse cx="44" cy="80" rx="7" ry="18" fill="#0f172a"/>
  <!-- Main Film Cylinder -->
  <path d="M 44 46 L 116 46 C 124 46 130 60 130 80 C 130 100 124 114 116 114 L 44 114 Z" fill="url(#rollGrad)"/>
  <ellipse cx="116" cy="80" rx="14" ry="34" fill="#10b981" stroke="#047857" stroke-width="1"/>
  <!-- Core Hole on Right -->
  <ellipse cx="116" cy="80" rx="6" ry="16" fill="#1e293b"/>
  <!-- Unwinding film web -->
  <path d="M 44 114 Q 70 135 120 130 L 135 124" fill="none" stroke="#6ee7b7" stroke-width="2" stroke-dasharray="2,2"/>
  <rect x="36" y="126" width="88" height="16" rx="3" fill="#065f46"/>
  <text x="80" y="137" fill="#ecfdf5" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">BOPP MATTE 320mm</text>
</svg>
`);

/** 9. Hot Stamping Gold & Metallic Foil */
export const SVG_FOIL_GOLD = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="goldBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="100%" stop-color="#fef3c7"/>
    </linearGradient>
    <linearGradient id="goldShine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#b45309"/>
      <stop offset="30%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="70%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#goldBg)"/>
  <!-- Foil Roll -->
  <ellipse cx="44" cy="75" rx="14" ry="34" fill="#92400e"/>
  <ellipse cx="44" cy="75" rx="6" ry="16" fill="#1e293b"/>
  <path d="M 44 41 L 116 41 C 124 41 130 55 130 75 C 130 95 124 109 116 109 L 44 109 Z" fill="url(#goldShine)"/>
  <ellipse cx="116" cy="75" rx="14" ry="34" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
  <ellipse cx="116" cy="75" rx="6" ry="16" fill="#451a03"/>
  <!-- Sparkles -->
  <text x="130" y="44" fill="#d97706" font-size="16">✦</text>
  <text x="32" y="38" fill="#d97706" font-size="12">✦</text>
  <rect x="36" y="122" width="88" height="16" rx="3" fill="#78350f"/>
  <text x="80" y="133" fill="#fef3c7" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">HOT FOIL 220mm</text>
</svg>
`);

/** 10. PUR / PVA Glue & Adhesives */
export const SVG_GLUE = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="glueBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0f9ff"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#glueBg)"/>
  <!-- Adhesive Drum / Dispenser -->
  <rect x="48" y="50" width="64" height="65" rx="6" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
  <ellipse cx="80" cy="50" rx="32" ry="10" fill="#38bdf8"/>
  <ellipse cx="80" cy="115" rx="32" ry="10" fill="#0369a1"/>
  <!-- Droplet -->
  <path d="M 80 16 C 80 16 68 34 68 40 C 68 47 73 52 80 52 C 87 52 92 47 92 40 C 92 34 80 16 80 16 Z" fill="#ffffff" stroke="#38bdf8" stroke-width="1.5"/>
  <rect x="54" y="72" width="52" height="24" rx="2" fill="#ffffff"/>
  <text x="80" y="84" fill="#0369a1" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle">PUR / PVA</text>
  <text x="80" y="93" fill="#64748b" font-size="7" font-family="monospace" text-anchor="middle">Kashirovka</text>
</svg>
`);

/** 11. Satin Ribbon & Textile Tape */
export const SVG_RIBBON_SATIN = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="satBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fdf2f8"/>
      <stop offset="100%" stop-color="#fce7f3"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#satBg)"/>
  <!-- Flanged Ribbon Spool -->
  <circle cx="80" cy="80" r="48" fill="#fbcfe8" stroke="#f472b6" stroke-width="2"/>
  <!-- Woven Ribbon winding -->
  <circle cx="80" cy="80" r="38" fill="#ffffff" stroke="#db2777" stroke-width="1.5"/>
  <circle cx="80" cy="80" r="28" fill="#fdf2f8"/>
  <circle cx="80" cy="80" r="12" fill="#831843"/>
  <!-- Ribbon Tail flowing out -->
  <path d="M 118 80 Q 140 100 135 125 L 120 125 Q 125 105 105 95 Z" fill="#ec4899"/>
  <rect x="36" y="132" width="88" height="16" rx="3" fill="#be185d"/>
  <text x="80" y="143" fill="#fdf2f8" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">SATIN 60mm</text>
</svg>
`);

/** 12. Jacquard / Weaving Yarn Cones */
export const SVG_YARN_CONE = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="yarnBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5f3ff"/>
      <stop offset="100%" stop-color="#ede9fe"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#yarnBg)"/>
  <!-- Bobbin core -->
  <polygon points="74,24 86,24 92,128 68,128" fill="#475569"/>
  <!-- Yarn body wound around cone -->
  <path d="M 70 36 L 90 36 L 115 120 C 115 128 45 128 45 120 Z" fill="#6366f1"/>
  <!-- Thread striations -->
  <line x1="68" y1="50" x2="92" y2="50" stroke="#a5b4fc" stroke-width="1.5"/>
  <line x1="62" y1="70" x2="98" y2="70" stroke="#a5b4fc" stroke-width="1.5"/>
  <line x1="56" y1="90" x2="104" y2="90" stroke="#a5b4fc" stroke-width="1.5"/>
  <line x1="50" y1="110" x2="110" y2="110" stroke="#a5b4fc" stroke-width="1.5"/>
  <rect x="36" y="132" width="88" height="16" rx="3" fill="#4338ca"/>
  <text x="80" y="143" fill="#e0e7ff" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">YARN 50D/75D</text>
</svg>
`);

/** 13. Delovoy Otxod / Offcuts & Scraps */
export const SVG_OFFCUT = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="offBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="100%" stop-color="#fef3c7"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#offBg)"/>
  <!-- Cut paper sheet stack -->
  <rect x="36" y="44" width="88" height="72" rx="4" fill="#cbd5e1" opacity="0.6"/>
  <rect x="32" y="38" width="88" height="72" rx="4" fill="#f8fafc" stroke="#f59e0b" stroke-width="1.5"/>
  <!-- Diagonal Scissor Cut Line -->
  <line x1="32" y1="74" x2="120" y2="74" stroke="#d97706" stroke-width="2" stroke-dasharray="4,3"/>
  <!-- Scissor icon -->
  <text x="24" y="78" fill="#d97706" font-size="14">✂</text>
  <!-- Offcut badge -->
  <rect x="34" y="86" width="84" height="18" rx="3" fill="#d97706"/>
  <text x="76" y="98" fill="#ffffff" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">DELOVOY OTXOD</text>
</svg>
`);

/** 14. Packaging Box / Straps */
export const SVG_BOX = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="boxBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f1f5f9"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#boxBg)"/>
  <!-- Isometric Carton Box -->
  <path d="M 80 30 L 125 55 L 80 80 L 35 55 Z" fill="#d97706"/>
  <path d="M 35 55 L 80 80 L 80 130 L 35 105 Z" fill="#b45309"/>
  <path d="M 80 80 L 125 55 L 125 105 L 80 130 Z" fill="#92400e"/>
  <!-- Packaging tape -->
  <line x1="58" y1="42" x2="102" y2="67" stroke="#fef3c7" stroke-width="3"/>
  <line x1="80" y1="80" x2="80" y2="130" stroke="#fef3c7" stroke-width="3"/>
</svg>
`);

/** 15. Generic Printing Material / Consumable fallback */
export const SVG_DEFAULT = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="defBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#defBg)"/>
  <rect x="36" y="36" width="88" height="88" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="80" cy="72" r="20" fill="#2563eb" opacity="0.1"/>
  <path d="M 80 62 L 90 78 L 70 78 Z" fill="#2563eb"/>
  <rect x="46" y="96" width="68" height="14" rx="3" fill="#2563eb"/>
  <text x="80" y="106" fill="#ffffff" font-size="7" font-family="monospace" font-weight="bold" text-anchor="middle">MATERIAL</text>
</svg>
`);

// ─── SKU Exact Match Dictionary ──────────────────────────────────────────────

export const SKU_IMAGE_MAP: Record<string, string> = {
  // Warehouse Stock SKUs
  "MAT-1010": SVG_PAPER_SILK,
  "MAT-1015": SVG_PAPER_SILK,
  "MAT-1020": SVG_CARDBOARD,
  "MAT-1025": SVG_KRAFT,
  "MAT-1030": SVG_COLORPLAN_EBONY,
  "MAT-1035": SVG_PAPER_SILK,
  "MAT-2010": SVG_RIBBON_SATIN,
  "MAT-2020": SVG_RIBBON_SATIN,
  "MAT-3010": SVG_GLUE,
  "MAT-4010": SVG_CTP_PLATE,
  "MAT-4020": SVG_INK_CMYK,
  "MAT-5010": SVG_FILM_ROLL,
  "MAT-1010-OFF": SVG_OFFCUT,
  "MAT-1020-OFF": SVG_OFFCUT,
  "MAT-1025-OFF": SVG_OFFCUT,

  // BOM Material IDs
  "MAT-PAP-014": SVG_PAPER_SILK,
  "MAT-INK-CMYK": SVG_INK_CMYK,
  "MAT-PLT-CTP": SVG_CTP_PLATE,
  "MAT-PLT-RMK1": SVG_CTP_PLATE,
  "MAT-LAM-M01": SVG_FILM_ROLL,
  "MAT-FLX-NYL": SVG_RIBBON_SATIN,
  "MAT-FLX-INK": SVG_INK_PANTONE,
  "MAT-FLX-PLT": SVG_CTP_PLATE,
  "MAT-FLX-RMK": SVG_CTP_PLATE,
  "MAT-YRN-WARP": SVG_YARN_CONE,
  "MAT-YRN-WEFT": SVG_YARN_CONE,
  "MAT-YRN-GLD": SVG_FOIL_GOLD,
  "MAT-CRD-300F": SVG_CARDBOARD,
  "MAT-CRD-300B": SVG_CARDBOARD,
  "MAT-GLU-PVA": SVG_GLUE,
  "MAT-LAM-SFT": SVG_FILM_ROLL,
  "MAT-PLT-CTP4": SVG_CTP_PLATE,
  "MAT-PAP-250": SVG_CARDBOARD,
  "MAT-VRN-SUV": SVG_INK_PANTONE,
  "MAT-FLX-SAT": SVG_RIBBON_SATIN,
  "MAT-FLX-GLD": SVG_FOIL_GOLD,
  "MAT-YRN-HDT": SVG_YARN_CONE,
  "MAT-PKG-STR": SVG_BOX,
  "MAT-PKG-BOX": SVG_BOX,

  // Legacy / Warehouse Stock Balance IDs
  "PAP-001": SVG_PAPER_SILK,
  "PAP-002": SVG_PAPER_SILK,
  "PAP-003": SVG_KRAFT,
  "PAP-004": SVG_CARDBOARD,
  "PAP-005": SVG_COLORPLAN_EBONY,
  "INK-001": SVG_INK_CMYK,
  "INK-002": SVG_INK_CMYK,
  "INK-003": SVG_INK_CMYK,
  "INK-004": SVG_INK_CMYK,
  "INK-005": SVG_INK_PANTONE,
  "INK-006": SVG_FOIL_GOLD,
  "CON-001": SVG_GLUE,
  "CON-002": SVG_INK_PANTONE,
  "CON-003": SVG_CTP_PLATE,
  "CON-004": SVG_INK_PANTONE,
  "CON-005": SVG_FILM_ROLL,
  "CON-006": SVG_GLUE,
  "CON-007": SVG_BOX,
  "CON-008": SVG_FILM_ROLL,
  "FIN-001": SVG_FOIL_GOLD,
  "FIN-002": SVG_FOIL_GOLD,
  "FIN-003": SVG_CARDBOARD,
  "PLT-001": SVG_CTP_PLATE,
  "PLT-002": SVG_CTP_PLATE,
  "THR-001": SVG_YARN_CONE,
};

// ─── Intelligent Material Image Resolver ──────────────────────────────────────

export interface MaterialLike {
  id?: string;
  sku?: string;
  name?: string;
  category?: string;
  spec?: string;
  imageUrl?: string;
  image?: string;
  isOffcut?: boolean;
}

/**
 * Resolves the most accurate and high-quality image URL for any material in the ERP.
 * 1. Checks item.imageUrl / item.image
 * 2. Matches exact SKU or ID in SKU_IMAGE_MAP
 * 3. Inspects name / category / specs using smart printing keyword taxonomy
 * 4. Falls back to clean procedural printing SVG
 */
export function getMaterialImage(item?: MaterialLike | null): string {
  if (!item) return SVG_DEFAULT;

  // 1. Explicit custom URL
  if (item.imageUrl && item.imageUrl.trim() !== "") {
    return item.imageUrl;
  }
  if (item.image && item.image.trim() !== "") {
    return item.image;
  }

  // 2. Offcut check
  if (item.isOffcut || (item.category && item.category.toLowerCase().includes("offcut"))) {
    return SVG_OFFCUT;
  }

  // 3. Exact SKU / ID match
  const rawKey = (item.sku || item.id || "").trim();
  if (rawKey && SKU_IMAGE_MAP[rawKey]) {
    return SKU_IMAGE_MAP[rawKey];
  }

  // 4. Keyword taxonomy
  const searchStr = `${item.sku || ""} ${item.id || ""} ${item.name || ""} ${item.category || ""} ${item.spec || ""}`.toLowerCase();

  if (searchStr.includes("offcut") || searchStr.includes("otxod") || searchStr.includes("scrap")) {
    return SVG_OFFCUT;
  }
  if (searchStr.includes("ebony") || searchStr.includes("colorplan") || searchStr.includes("black paper")) {
    return SVG_COLORPLAN_EBONY;
  }
  if (searchStr.includes("kraft")) {
    return SVG_KRAFT;
  }
  if (searchStr.includes("cardboard") || searchStr.includes("carton") || searchStr.includes("board")) {
    return SVG_CARDBOARD;
  }
  if (searchStr.includes("cmyk") || searchStr.includes("cyan") || searchStr.includes("magenta") || (searchStr.includes("ink") && !searchStr.includes("pantone"))) {
    return SVG_INK_CMYK;
  }
  if (searchStr.includes("pantone") || searchStr.includes("varnish") || searchStr.includes("spot uv") || searchStr.includes("lacquer")) {
    return SVG_INK_PANTONE;
  }
  if (searchStr.includes("plate") || searchStr.includes("ctp") || searchStr.includes("photopolymer")) {
    return SVG_CTP_PLATE;
  }
  if (searchStr.includes("foil") || searchStr.includes("gold") || searchStr.includes("holograph")) {
    return SVG_FOIL_GOLD;
  }
  if (searchStr.includes("lamination") || searchStr.includes("film") || searchStr.includes("bopp")) {
    return SVG_FILM_ROLL;
  }
  if (searchStr.includes("glue") || searchStr.includes("pur") || searchStr.includes("pva") || searchStr.includes("adhesive")) {
    return SVG_GLUE;
  }
  if (searchStr.includes("satin") || searchStr.includes("ribbon") || searchStr.includes("taffeta") || searchStr.includes("tape")) {
    return SVG_RIBBON_SATIN;
  }
  if (searchStr.includes("yarn") || searchStr.includes("thread") || searchStr.includes("lurex") || searchStr.includes("warp") || searchStr.includes("weft")) {
    return SVG_YARN_CONE;
  }
  if (searchStr.includes("box") || searchStr.includes("strap") || searchStr.includes("packaging")) {
    return SVG_BOX;
  }
  if (searchStr.includes("silk") || searchStr.includes("gloss") || searchStr.includes("paper") || searchStr.includes("munken") || searchStr.includes("sheet")) {
    return SVG_PAPER_SILK;
  }

  // 5. Category-based fallback
  const cat = (item.category || "").toLowerCase();
  if (cat.includes("paper") || cat.includes("board")) return SVG_PAPER_SILK;
  if (cat.includes("ink") || cat.includes("plate")) return SVG_INK_CMYK;
  if (cat.includes("foil") || cat.includes("film")) return SVG_FOIL_GOLD;
  if (cat.includes("adhesive") || cat.includes("binding")) return SVG_GLUE;
  if (cat.includes("roll") || cat.includes("label")) return SVG_RIBBON_SATIN;

  return SVG_DEFAULT;
}
