import { jsPDF } from "jspdf";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CompanyInfo {
  name: string;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  siret?: string | null;
  iban?: string | null;
  bank_account_name?: string | null;
  legal_entity_name?: string | null;
  legal_mentions?: string | null;
  tva_mention?: string | null;
  logo_url?: string | null;
  color?: string | null;
}

interface ClientInfo {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
}

interface QuotePdfData {
  quote_number: string;
  created_at: string;
  sent_at: string | null;
  total_ht: number;
  tva_rate: number;
  total_ttc: number;
  tax_credit_amount: number;
  estimated_duration?: string | null;
  client: ClientInfo;
  company: CompanyInfo;
  lines: { label: string; quantity: number; unit_price_ht: number; total_ht: number }[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtDate(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(y, m - 1, day + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Parse hex color to RGB tuple */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Check if we need a new page, and add one if so. Returns updated y. */
function checkPage(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > 275) {
    doc.addPage();
    return margin;
  }
  return y;
}

/* ------------------------------------------------------------------ */
/*  PDF Generator                                                      */
/* ------------------------------------------------------------------ */

export function generateQuotePdf(data: QuotePdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const margin = 20;
  const contentW = pw - 2 * margin;
  const rightEdge = pw - margin;
  let y = margin;

  const accent = data.company.color ? hexToRgb(data.company.color) : [33, 150, 243] as [number, number, number];
  const accentLight: [number, number, number] = [
    Math.min(accent[0] + 200, 245),
    Math.min(accent[1] + 200, 247),
    Math.min(accent[2] + 200, 250),
  ];
  const companyName = data.company.name ?? "Makematik";
  const companyAddr = [data.company.address, data.company.postal_code, data.company.city].filter(Boolean).join(", ");

  /* ── EN-TÊTE ── */

  // Left: company name + address + phone
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(companyName, margin, y + 2);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  let leftY = y + 9;
  if (companyAddr) { doc.text(companyAddr, margin, leftY); leftY += 4; }
  if (data.company.phone) { doc.text(`T\u00E9l : ${data.company.phone}`, margin, leftY); leftY += 4; }
  if (data.company.email) { doc.text(data.company.email, margin, leftY); leftY += 4; }

  // Right: DEVIS title + number + date
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text("DEVIS", rightEdge, y + 2, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`N\u00B0 ${data.quote_number}`, rightEdge, y + 10, { align: "right" });
  doc.text(`Date : ${fmtDate(data.created_at)}`, rightEdge, y + 15, { align: "right" });
  if (data.sent_at) {
    doc.text(`Envoy\u00E9 le : ${fmtDate(data.sent_at)}`, rightEdge, y + 20, { align: "right" });
  }

  y = Math.max(leftY, y + 24) + 4;

  // Accent line
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  /* ── BLOC CLIENT ── */

  doc.setFillColor(245, 247, 250);
  const clientBlockStart = y;
  // Reserve space — we'll draw the rect after measuring content
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text("CLIENT", margin + 5, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text(`${data.client.first_name} ${data.client.last_name}`, margin + 5, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  const clientAddr = [data.client.address, data.client.postal_code, data.client.city].filter(Boolean).join(", ");
  if (clientAddr) { doc.text(clientAddr, margin + 5, y); y += 4; }
  if (data.client.phone) { doc.text(`T\u00E9l : ${data.client.phone}`, margin + 5, y); y += 4; }
  if (data.client.email) { doc.text(data.client.email, margin + 5, y); y += 4; }
  y += 3;

  // Draw client background rect
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, clientBlockStart, contentW, y - clientBlockStart, 2, 2, "F");

  // Redraw text on top of rect (jsPDF draws in order)
  // We need to re-render the text since the rect was drawn after. Use a simpler approach:
  // Actually jsPDF draws sequentially, so the rect covers the text. Let's restructure:
  // Draw rect first, then text. Reset y and redo.

  // --- Restart client block with rect first ---
  y = clientBlockStart;
  const clientContentH = 22 + (clientAddr ? 4 : 0) + (data.client.phone ? 4 : 0) + (data.client.email ? 4 : 0);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentW, clientContentH, 2, 2, "F");

  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text("CLIENT", margin + 5, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text(`${data.client.first_name} ${data.client.last_name}`, margin + 5, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  if (clientAddr) { doc.text(clientAddr, margin + 5, y); y += 4; }
  if (data.client.phone) { doc.text(`T\u00E9l : ${data.client.phone}`, margin + 5, y); y += 4; }
  if (data.client.email) { doc.text(data.client.email, margin + 5, y); y += 4; }

  y = clientBlockStart + clientContentH + 8;

  /* ── TABLEAU LIGNES ── */

  const colDesig = margin + 3;
  const colQty = margin + contentW * 0.52;
  const colUnit = margin + contentW * 0.62;
  const colPU = margin + contentW * 0.75;
  const colTotal = rightEdge - 3;

  // Table header
  y = checkPage(doc, y, 12, margin);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(margin, y, contentW, 9, 1, 1, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text("D\u00E9signation", colDesig, y + 6);
  doc.text("Qt\u00E9", colQty, y + 6);
  doc.text("Unit\u00E9", colUnit, y + 6);
  doc.text("P.U. HT", colPU, y + 6);
  doc.text("Total HT", colTotal, y + 6, { align: "right" });
  y += 11;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (let i = 0; i < data.lines.length; i++) {
    y = checkPage(doc, y, 10, margin);
    const line = data.lines[i];

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(accentLight[0], accentLight[1], accentLight[2]);
      doc.rect(margin, y - 1, contentW, 8, "F");
    }

    doc.setTextColor(30);
    // Truncate long labels
    const labelLines = doc.splitTextToSize(line.label, contentW * 0.48);
    doc.text(labelLines[0], colDesig, y + 4);
    doc.text(String(line.quantity), colQty, y + 4);
    doc.text("u", colUnit, y + 4);
    doc.setTextColor(60);
    doc.text(fmtEur(line.unit_price_ht), colPU, y + 4);
    doc.setTextColor(30);
    doc.text(fmtEur(line.total_ht), colTotal, y + 4, { align: "right" });

    y += 8;
  }

  // Bottom line of table
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  /* ── TOTAUX ── */

  y = checkPage(doc, y, 40, margin);
  const totLabelX = margin + contentW * 0.58;
  const totValX = colTotal;

  // Total HT
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text("Total HT", totLabelX, y);
  doc.setTextColor(30);
  doc.text(fmtEur(data.total_ht), totValX, y, { align: "right" });
  y += 5;

  // TVA
  if (data.tva_rate > 0) {
    const tvaAmt = data.total_ht * (data.tva_rate / 100);
    doc.setTextColor(60);
    doc.text(`TVA ${data.tva_rate}%`, totLabelX, y);
    doc.setTextColor(30);
    doc.text(fmtEur(tvaAmt), totValX, y, { align: "right" });
    y += 5;
  } else if (data.company.tva_mention) {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(data.company.tva_mention, totLabelX, y, { maxWidth: contentW * 0.4 });
    y += 5;
  }

  // Total TTC
  y += 1;
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(totLabelX - 3, y - 4, rightEdge - totLabelX + 6, 9, 1, 1, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text("Total TTC", totLabelX, y + 2);
  doc.text(fmtEur(data.total_ttc), totValX, y + 2, { align: "right" });
  y += 10;

  // Tax credit
  if (data.tax_credit_amount > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 128, 0);
    doc.text("Cr\u00E9dit d'imp\u00F4t 50%", totLabelX, y);
    doc.text(`- ${fmtEur(data.tax_credit_amount)}`, totValX, y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Co\u00FBt r\u00E9el apr\u00E8s cr\u00E9dit d'imp\u00F4t", totLabelX, y);
    doc.text(fmtEur(data.total_ttc - data.tax_credit_amount), totValX, y, { align: "right" });
    y += 6;
  }

  // Estimated duration
  if (data.estimated_duration) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(`Temps de travail estim\u00E9 : ${data.estimated_duration}`, totLabelX, y);
    y += 6;
  }

  /* ── ZONE SIGNATURE ── */

  y = checkPage(doc, y, 50, margin);
  y += 8;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Bon pour accord", margin, y);
  doc.text("L'entrepreneur", margin + contentW * 0.55, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Date et signature du client :", margin, y);
  doc.text("(pr\u00E9c\u00E9d\u00E9 de la mention \u00ABBon pour accord\u00BB)", margin, y + 4);

  // Signature lines
  y += 16;
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + contentW * 0.4, y);
  doc.line(margin + contentW * 0.55, y, rightEdge, y);

  /* ── PIED DE PAGE ── */

  // Position footer at bottom of page
  const footerY = 277;
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, rightEdge, footerY - 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);

  const footerLines: string[] = [];
  if (data.company.legal_entity_name) {
    footerLines.push(data.company.legal_entity_name + (companyAddr ? ` \u2014 ${companyAddr}` : ""));
  }
  if (data.company.siret) {
    footerLines.push(`SIRET : ${data.company.siret}`);
  }
  if (data.company.legal_mentions) {
    footerLines.push(data.company.legal_mentions);
  }
  if (data.company.tva_mention) {
    footerLines.push(data.company.tva_mention);
  }
  footerLines.push(`Date de validit\u00E9 : ${addDaysToDate(data.created_at, 30)}`);

  let fy = footerY;
  for (const line of footerLines) {
    doc.text(line, pw / 2, fy, { align: "center", maxWidth: contentW });
    fy += 3.5;
  }

  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}
