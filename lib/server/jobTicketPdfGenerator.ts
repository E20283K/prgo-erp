import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";

const DOC_SERVICE_URL = process.env.DOC_SERVICE_URL ?? "http://localhost:8000";
const PDF_CACHE_DIR = path.join(process.cwd(), "public", "cache", "telegram", "job-tickets");

function ensurePdfDir() {
  if (!fs.existsSync(PDF_CACHE_DIR)) {
    fs.mkdirSync(PDF_CACHE_DIR, { recursive: true });
  }
}

export interface JobTicketOrderData {
  docNo: string;
  clientName: string;
  productName: string;
  quantity: number | string;
  unit?: string;
  department?: string;
  site?: string;
  pressMachine?: string;
  orderDate?: string;
  deadline?: string;
  paperStock?: string;
  coating?: string;
  lamination?: string;
  embellishment?: string;
  width?: number;
  height?: number;
  status?: string;
  stage?: string;
  priority?: string;
  operations?: Array<{
    name: string;
    department?: string;
    machineStr?: string;
    operator?: string;
    status?: string;
    durationHours?: number | string;
  }>;
  notes?: string;
}

/**
 * Rasmiy A4 PDF Texnik Pasport (Job Ticket) generatsiya qilish
 */
export async function generateJobTicketPdf(order: JobTicketOrderData): Promise<{
  localPath: string;
  publicUrl: string;
  fileName: string;
  buffer: Buffer;
}> {
  ensurePdfDir();

  const safeDocNo = (order.docNo || "ZAKAZ").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Order_Passport_${safeDocNo}_${Date.now()}.pdf`;
  const localPath = path.join(PDF_CACHE_DIR, fileName);

  // 1. Agar doc-service online bo'lsa, ReportLab orqali generatsiya qilishga urinish
  try {
    const res = await fetch(`${DOC_SERVICE_URL}/generate/pdf/job-ticket`, {
      method: "POST",
      signal: AbortSignal.timeout(2500),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docNo: order.docNo,
        orderData: {
          ...order,
          customer: order.clientName,
          product: order.productName,
          quantity: Number(order.quantity) || 0,
          unit: order.unit || "dona",
        },
        operations: order.operations || [],
        saveToS3: false,
      }),
    });

    if (res.ok) {
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);
      fs.writeFileSync(localPath, buffer);
      return {
        localPath,
        publicUrl: `/cache/telegram/job-tickets/${fileName}`,
        fileName: `Order_Passport_${safeDocNo}.pdf`,
        buffer,
      };
    }
  } catch (_) {
    // doc-service oflayn bo'lsa, to'g'ridan-to'g'ri jsPDF orqali yaratiladi
  }

  // 2. Standart A4 jsPDF Texnik Pasport generatsiyasi (0 xatolik, toza poligrafik dizayn)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm

  // Header Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.rect(margin, 12, contentWidth, 24, "FD");

  // Title & Company
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text("PRINTGOO ERP", margin + 4, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("POLIGRAFIYA ISHLAB CHIQARISH TEXNIK PASPORTI", margin + 4, 25);
  doc.text(`Chop etilgan sana: ${new Date().toLocaleDateString("uz-UZ")} ${new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`, margin + 4, 30);

  // Doc Number & Status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(order.docNo || "ZAKAZ", pageWidth - margin - 4, 21, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(220, 38, 38); // red-600
  doc.text(`Holati: ${(order.status || "Active").toUpperCase()} | Bosqich: ${(order.stage || "Queue").toUpperCase()}`, pageWidth - margin - 4, 28, { align: "right" });

  // ─── 1. Asosiy Parametrlar Jadvali ─────────────────────────────────────────
  let curY = 41;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. ASOSIY BUYURTMA MA'LUMOTLARI", margin + 3, curY + 4.2);

  curY += 6;
  doc.rect(margin, curY, contentWidth, 32, "S");

  const col1X = margin + 3;
  const col2X = margin + (contentWidth / 2) + 3;

  doc.setFontSize(8);
  const rowH = 6.2;

  // Row 1
  doc.setFont("helvetica", "bold"); doc.text("Buyurtmachi (Mijoz):", col1X, curY + 5);
  doc.setFont("helvetica", "normal"); doc.text(order.clientName || "-", col1X + 36, curY + 5);

  doc.setFont("helvetica", "bold"); doc.text("Topshirish muddati:", col2X, curY + 5);
  doc.setFont("helvetica", "normal"); doc.text(order.deadline || "Kelishilmoqda", col2X + 34, curY + 5);

  // Row 2
  doc.setFont("helvetica", "bold"); doc.text("Mahsulot turi:", col1X, curY + 5 + rowH);
  doc.setFont("helvetica", "normal"); doc.text(order.productName || "-", col1X + 36, curY + 5 + rowH);

  doc.setFont("helvetica", "bold"); doc.text("Buyurtma sanasi:", col2X, curY + 5 + rowH);
  doc.setFont("helvetica", "normal"); doc.text(order.orderDate || "-", col2X + 34, curY + 5 + rowH);

  // Row 3
  doc.setFont("helvetica", "bold"); doc.text("Tiraj (Miqdori):", col1X, curY + 5 + rowH * 2);
  doc.setFont("helvetica", "bold"); doc.setTextColor(220, 38, 38);
  doc.text(`${Number(order.quantity || 0).toLocaleString("uz-UZ")} ${order.unit || "dona"}`, col1X + 36, curY + 5 + rowH * 2);
  doc.setTextColor(15, 23, 42);

  doc.setFont("helvetica", "bold"); doc.text("Dastgoh (Mashina):", col2X, curY + 5 + rowH * 2);
  doc.setFont("helvetica", "normal"); doc.text(order.pressMachine || "Asosiy offset", col2X + 34, curY + 5 + rowH * 2);

  // Row 4
  doc.setFont("helvetica", "bold"); doc.text("Uchastka / Bo'lim:", col1X, curY + 5 + rowH * 3);
  doc.setFont("helvetica", "normal"); doc.text(`${order.department || "Offset"} (${order.site || "Toshkent"})`, col1X + 36, curY + 5 + rowH * 3);

  doc.setFont("helvetica", "bold"); doc.text("Muhimlik darajasi:", col2X, curY + 5 + rowH * 3);
  doc.setFont("helvetica", "normal"); doc.text(order.priority || "Normal", col2X + 34, curY + 5 + rowH * 3);

  // ─── 2. Poligrafik Texnik Parametrlar ───────────────────────────────────────
  curY += 37;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("2. POLIGRAFIK TEXNIK XUSUSIYATLARI VA ISHLOV", margin + 3, curY + 4.2);

  curY += 6;
  doc.rect(margin, curY, contentWidth, 30, "S");

  const w = Number(order.width) || 50;
  const h = Number(order.height) || 125;
  const dimStr = `${(h / 10).toFixed(1)} x ${(w / 10).toFixed(1)} cm (${h} x ${w} mm)`;

  const finishList: string[] = [];
  if (order.coating) finishList.push(order.coating);
  if (order.lamination) finishList.push(order.lamination);
  if (order.embellishment) finishList.push(order.embellishment);
  const finishStr = finishList.length > 0 ? finishList.join(", ") : "Standart";

  // Row 1
  doc.setFont("helvetica", "bold"); doc.text("Qog'oz / Material:", col1X, curY + 5);
  doc.setFont("helvetica", "normal"); doc.text(order.paperStock || "Karton", col1X + 36, curY + 5);

  doc.setFont("helvetica", "bold"); doc.text("Mahsulot o'lchami:", col2X, curY + 5);
  doc.setFont("helvetica", "bold"); doc.setTextColor(220, 38, 38);
  doc.text(dimStr, col2X + 34, curY + 5);
  doc.setTextColor(15, 23, 42);

  // Row 2
  doc.setFont("helvetica", "bold"); doc.text("Maxsus ishlovlar:", col1X, curY + 5 + rowH);
  doc.setFont("helvetica", "normal"); doc.text(finishStr, col1X + 36, curY + 5 + rowH);

  doc.setFont("helvetica", "bold"); doc.text("Pichoq / Shakl turi:", col2X, curY + 5 + rowH);
  doc.setFont("helvetica", "normal"); doc.text("Burchaklari qirqilgan (Chamfer) + Teshik", col2X + 34, curY + 5 + rowH);

  // Row 3
  doc.setFont("helvetica", "bold"); doc.text("Ranglar formulasi:", col1X, curY + 5 + rowH * 2);
  doc.setFont("helvetica", "normal"); doc.text("CMYK (Oldi / Orqa)", col1X + 36, curY + 5 + rowH * 2);

  doc.setFont("helvetica", "bold"); doc.text("Laminatsiya / Qoplama:", col2X, curY + 5 + rowH * 2);
  doc.setFont("helvetica", "normal"); doc.text(order.lamination || "Mavjud emas", col2X + 34, curY + 5 + rowH * 2);

  // Row 4
  doc.setFont("helvetica", "bold"); doc.text("Qo'shimcha izoh:", col1X, curY + 5 + rowH * 3);
  doc.setFont("helvetica", "normal"); doc.text(order.notes ? order.notes.slice(0, 80) : "Qat'iy texnik reglamentga rioya qilinsin", col1X + 36, curY + 5 + rowH * 3);

  // ─── 3. Texnologik Marshrut (Operatsiyalar Jadvali) ────────────────────────
  curY += 35;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("3. ISHLAB CHIQARISH TEXNOLOGIK ZANJIRI VA OPERATSIYALAR", margin + 3, curY + 4.2);

  curY += 6;

  // Table Header
  const colW = [12, 54, 46, 26, 24, 20];
  const tableHeaderY = curY;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, tableHeaderY, contentWidth, 6, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  let tX = margin + 2;
  doc.text("№", tX, tableHeaderY + 4.2); tX += colW[0];
  doc.text("Operatsiya nomi", tX, tableHeaderY + 4.2); tX += colW[1];
  doc.text("Dastgoh / Bo'lim", tX, tableHeaderY + 4.2); tX += colW[2];
  doc.text("Me'yor (soat)", tX, tableHeaderY + 4.2); tX += colW[3];
  doc.text("Holati", tX, tableHeaderY + 4.2); tX += colW[4];
  doc.text("Imzo / Sana", tX, tableHeaderY + 4.2);

  curY += 6;

  // Default operations if none provided
  const ops = order.operations && order.operations.length > 0
    ? order.operations
    : [
        { name: "Prepress / Fayl tekshiruvi va CTP", machineStr: "Suprasetter CTP", durationHours: "1.0", status: "Tayyor" },
        { name: "Chop etish (Offset bosma)", machineStr: order.pressMachine || "Heidelberg Speedmaster", durationHours: "3.5", status: "Navbatda" },
        { name: "UV / Emboss lak qoplash", machineStr: "Laklash mashinasi", durationHours: "1.5", status: "Kutilmoqda" },
        { name: "Shtamp kesim (Die-cutting)", machineStr: "Bobst avtomat pichoq", durationHours: "2.0", status: "Kutilmoqda" },
        { name: "Qadoqlash va sifat nazorati (OTK)", machineStr: "Qadoqlash stoli", durationHours: "1.0", status: "Kutilmoqda" },
      ];

  doc.setFont("helvetica", "normal");
  ops.forEach((op, idx) => {
    const rowY = curY + (idx * 6.5);
    doc.rect(margin, rowY, contentWidth, 6.5, "S");

    let rX = margin + 2;
    doc.text(String(idx + 1), rX, rowY + 4.5); rX += colW[0];
    doc.text((op.name || "-").slice(0, 32), rX, rowY + 4.5); rX += colW[1];
    doc.text((op.machineStr || op.department || "-").slice(0, 26), rX, rowY + 4.5); rX += colW[2];
    doc.text(String(op.durationHours || "1.0"), rX, rowY + 4.5); rX += colW[3];
    doc.text(op.status || "Kutilmoqda", rX, rowY + 4.5); rX += colW[4];
    doc.text("[          ]", rX, rowY + 4.5);
  });

  // ─── 4. Imzolar va Mas'ullar ───────────────────────────────────────────────
  const signY = 240;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, signY, contentWidth, 26, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("4. MAS'UL SHAXSLARNING IMZOLARI", margin + 3, signY + 5);

  const signColW = contentWidth / 3;
  const s1 = margin + 3;
  const s2 = margin + signColW + 3;
  const s3 = margin + (signColW * 2) + 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Texnolog / Menejer:", s1, signY + 12);
  doc.text("Imzo: _____________________", s1, signY + 19);

  doc.text("Sex / Smena ustasi:", s2, signY + 12);
  doc.text("Imzo: _____________________", s2, signY + 19);

  doc.text("OTK / Sifat nazorati:", s3, signY + 12);
  doc.text("Imzo: _____________________", s3, signY + 19);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("PrintGoo ERP — Avtomatlashtirilgan sanoat boshqaruv tizimi | Ushbu hujjat qat'iy ishlab chiqarish topshirig'i hisoblanadi.", pageWidth / 2, 280, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(localPath, buffer);

  return {
    localPath,
    publicUrl: `/cache/telegram/job-tickets/${fileName}`,
    fileName: `Order_Passport_${safeDocNo}.pdf`,
    buffer,
  };
}
