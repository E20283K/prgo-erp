import fs from "fs";
import path from "path";

const DOC_SERVICE_URL = process.env.DOC_SERVICE_URL ?? "http://localhost:8000";
const CARDS_CACHE_DIR = path.join(process.cwd(), "public", "cache", "telegram", "tech-cards");

function ensureCardsDir() {
  if (!fs.existsSync(CARDS_CACHE_DIR)) {
    fs.mkdirSync(CARDS_CACHE_DIR, { recursive: true });
  }
}

export interface TechCardParams {
  clientName: string;
  orderNo: string;
  productName?: string;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  frontImageBase64?: string | null;
  backImageBase64?: string | null;
  shapeType?: "chamfer" | "rectangle" | "rounded";
  widthMm?: number;
  heightMm?: number;
  cornerCutMm?: number;
  holeDiameterMm?: number;
  hasHole?: boolean;
  embellishments?: string[];
  paperStock?: string | null;
  finishing?: string | null;
  quantity?: number | string | null;
}

/**
 * Doc-service yoki SVG orqali yuqori sifatli buyurtma texnik pasport rasmini generatsiya qilish
 */
export async function generateTechCardImage(params: TechCardParams): Promise<{
  localPath: string;
  publicUrl: string;
  format: "png" | "svg";
  buffer: Buffer;
}> {
  ensureCardsDir();

  const safeOrderNo = params.orderNo.replace(/[^a-zA-Z0-9_-]/g, "_");
  const pngFileName = `card_${safeOrderNo}_${Date.now()}.png`;
  const pngLocalPath = path.join(CARDS_CACHE_DIR, pngFileName);

  // 1. Doc-service orqali PNG generatsiya qilishga urinish
  try {
    const res = await fetch(`${DOC_SERVICE_URL}/api/pdf/generate-tech-card`, {
      method: "POST",
      signal: AbortSignal.timeout(2500),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: params.clientName || "BIRYUZA GROUP",
        orderNo: params.orderNo || "ZAKAZ",
        productName: params.productName || "KARTON ETIKETKA",
        frontImageUrl: params.frontImageUrl || undefined,
        backImageUrl: params.backImageUrl || undefined,
        frontImageBase64: params.frontImageBase64 || undefined,
        backImageBase64: params.backImageBase64 || undefined,
        shapeType: params.shapeType || "chamfer",
        widthMm: params.widthMm || 50,
        heightMm: params.heightMm || 125,
        cornerCutMm: params.cornerCutMm || 8,
        holeDiameterMm: params.holeDiameterMm || 4,
        hasHole: params.hasHole !== false,
        embellishments: params.embellishments || ["UV"],
        paperStock: params.paperStock || "400 GRAM FANTAZI",
        finishing: params.finishing || "OLDI EMBOSS LAK",
        quantity: params.quantity ? Number(params.quantity).toLocaleString("uz-UZ") : "10 000",
      }),
    });

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(pngLocalPath, buffer);
      return {
        localPath: pngLocalPath,
        publicUrl: `/cache/telegram/tech-cards/${pngFileName}`,
        format: "png",
        buffer,
      };
    } else {
      console.warn(`[generateTechCardImage] doc-service returned status ${res.status}`);
    }
  } catch (err) {
    console.warn("[generateTechCardImage] doc-service unreachable, using SVG fallback:", err);
  }

  // 2. SVG Fallback generatsiya (doc-service bo'lmaganda)
  const svgFileName = `card_${safeOrderNo}_${Date.now()}.svg`;
  const svgLocalPath = path.join(CARDS_CACHE_DIR, svgFileName);

  const wMm = params.widthMm || 50;
  const hMm = params.heightMm || 125;
  const wCm = wMm > 10 ? (wMm / 10).toFixed(1) : wMm.toFixed(1);
  const hCm = hMm > 10 ? (hMm / 10).toFixed(1) : hMm.toFixed(1);
  const qtyStr = params.quantity ? Number(params.quantity).toLocaleString("uz-UZ") : "10 000";

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="1300" viewBox="0 0 1000 1300" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <rect width="1000" height="1300" fill="#ffffff" />
  
  <!-- Sarlavha -->
  <text x="500" y="65" font-size="34" font-weight="800" fill="#1e3a8a" text-anchor="middle" letter-spacing="1">* ${escapeXml(params.clientName.toUpperCase())} *</text>
  <text x="500" y="115" font-size="30" font-weight="800" fill="#111827" text-anchor="middle" letter-spacing="1">${escapeXml(params.orderNo.toUpperCase())} ZAKAZ</text>

  <!-- Oldi va Orqa Qoliplar -->
  <g transform="translate(190, 180)">
    <!-- OLDI -->
    <path d="M 35 0 L 215 0 L 250 35 L 250 550 L 0 550 L 0 35 Z" fill="#212529" stroke="#111827" stroke-width="2" />
    <circle cx="125" cy="45" r="12" fill="#ffffff" stroke="#111827" stroke-width="2" />
    <text x="125" y="320" font-size="28" font-weight="800" fill="#4b5563" text-anchor="middle" letter-spacing="2">SQUAD</text>
    <text x="125" y="355" font-size="28" font-weight="800" fill="#4b5563" text-anchor="middle" letter-spacing="2">BLACK</text>
    <text x="125" y="590" font-size="24" font-weight="800" fill="#dc2626" text-anchor="middle">OLDI</text>

    <!-- UV Ko'rsatkichi -->
    <line x1="-50" y1="330" x2="10" y2="330" stroke="#dc2626" stroke-width="2" />
    <line x1="-50" y1="330" x2="-50" y2="305" stroke="#dc2626" stroke-width="2" />
    <text x="-50" y="295" font-size="22" font-weight="800" fill="#dc2626" text-anchor="middle">UV</text>
  </g>

  <g transform="translate(560, 180)">
    <!-- ORQA -->
    <path d="M 35 0 L 215 0 L 250 35 L 250 550 L 0 550 L 0 35 Z" fill="#212529" stroke="#111827" stroke-width="2" />
    <circle cx="125" cy="45" r="12" fill="#ffffff" stroke="#111827" stroke-width="2" />
    <text x="125" y="590" font-size="24" font-weight="800" fill="#dc2626" text-anchor="middle">ORQA</text>
  </g>

  <!-- Spetsifikatsiya Parametrlari -->
  <g transform="translate(500, 860)" text-anchor="middle">
    <text y="0" font-size="28" font-weight="800" fill="#18181b">${escapeXml((params.productName || "KARTON ETIKETKA").toUpperCase())}</text>
    <text y="45" font-size="24" font-weight="700" fill="#18181b">${escapeXml((params.paperStock || "400 GRAM FANTAZI").toUpperCase())}</text>
    <text y="90" font-size="24" font-weight="700" fill="#18181b">${escapeXml((params.finishing || "OLDI EMBOSS LAK").toUpperCase())}</text>
    
    <text y="165" font-size="28" font-weight="800" fill="#dc2626">RAZMERI : ${hCm} X ${wCm} CM</text>
    <text y="235" font-size="30" font-weight="800" fill="#dc2626">SONI : ${qtyStr}</text>
  </g>
</svg>`;

  const svgBuffer = Buffer.from(svgContent, "utf-8");
  fs.writeFileSync(svgLocalPath, svgBuffer);

  return {
    localPath: svgLocalPath,
    publicUrl: `/cache/telegram/tech-cards/${svgFileName}`,
    format: "svg",
    buffer: svgBuffer,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
