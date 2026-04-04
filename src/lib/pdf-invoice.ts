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

interface InvoicePdfData {
  invoice_number: string;
  created_at: string;
  status: string;
  payment_method: string | null;
  payment_date: string | null;
  payment_due_date: string | null;
  late_fee_percentage: number;
  late_fee_applied: boolean;
  total_ht: number;
  tva_rate: number;
  total_tva: number;
  total_ttc: number;
  tax_credit_applicable: boolean;
  tax_credit_amount: number;
  quote_number: string | null;
  client: ClientInfo;
  company: CompanyInfo;
  lines: { label: string; quantity: number; unit_price: number; total_ht: number }[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Esp\u00E8ces", check: "Ch\u00E8que", card: "CB", deferred: "Virement",
};

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtDate(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

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

export function generateInvoicePdf(data: InvoicePdfData): Buffer {
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

  /* ── EN-T\u00CATE ── */

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

  // Right: FACTURE title + number + date
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text("FACTURE", rightEdge, y + 2, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  let rightY = y + 10;
  doc.text(`N\u00B0 ${data.invoice_number}`, rightEdge, rightY, { align: "right" });
  rightY += 5;
  doc.text(`Date : ${fmtDate(data.created_at)}`, rightEdge, rightY, { align: "right" });
  rightY += 5;

  // Quote reference
  if (data.quote_number) {
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Correspondant au devis N\u00B0 ${data.quote_number}`, rightEdge, rightY, { align: "right" });
    rightY += 5;
  }

  // Payment status badge
  if (data.status === "paid" && data.payment_date) {
    doc.setFontSize(9);
    doc.setTextColor(0, 128, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`Acquitt\u00E9e le ${fmtDate(data.payment_date)}`, rightEdge, rightY, { align: "right" });
    rightY += 5;
  } else if (data.payment_due_date) {
    doc.setFontSize(9);
    doc.setTextColor(200, 100, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`\u00C9ch\u00E9ance : ${fmtDate(data.payment_due_date)}`, rightEdge, rightY, { align: "right" });
    rightY += 5;
  }

  y = Math.max(leftY, rightY) + 2;

  // Accent line
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  /* ── BLOC CLIENT ── */

  const clientContentH = 22 + (data.client.address ? 4 : 0) + (data.client.phone ? 4 : 0) + (data.client.email ? 4 : 0);
  const clientBlockStart = y;
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
  const clientAddr = [data.client.address, data.client.postal_code, data.client.city].filter(Boolean).join(", ");
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

    if (i % 2 === 0) {
      doc.setFillColor(accentLight[0], accentLight[1], accentLight[2]);
      doc.rect(margin, y - 1, contentW, 8, "F");
    }

    doc.setTextColor(30);
    const labelLines = doc.splitTextToSize(line.label, contentW * 0.48);
    doc.text(labelLines[0], colDesig, y + 4);
    doc.text(String(line.quantity), colQty, y + 4);
    doc.text("u", colUnit, y + 4);
    doc.setTextColor(60);
    doc.text(fmtEur(line.unit_price), colPU, y + 4);
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
    doc.setTextColor(60);
    doc.text(`TVA ${data.tva_rate}%`, totLabelX, y);
    doc.setTextColor(30);
    doc.text(fmtEur(data.total_tva), totValX, y, { align: "right" });
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
  if (data.tax_credit_applicable && data.tax_credit_amount > 0) {
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

  /* ── PAIEMENT ── */

  y = checkPage(doc, y, 30, margin);
  y += 4;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightEdge, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text("PAIEMENT", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30);

  if (data.status === "paid") {
    const methodLabel = data.payment_method ? (PAYMENT_LABELS[data.payment_method] ?? data.payment_method) : "";
    doc.setTextColor(0, 128, 0);
    doc.setFont("helvetica", "bold");
    let paidText = "Facture r\u00E9gl\u00E9e";
    if (methodLabel) paidText += ` (mode : ${methodLabel})`;
    if (data.payment_date) paidText += ` le ${fmtDate(data.payment_date)}`;
    doc.text(paidText, margin, y);
    y += 5;
  } else {
    // Due date
    if (data.payment_due_date) {
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(`\u00C9ch\u00E9ance de paiement : ${fmtDate(data.payment_due_date)}`, margin, y);
      y += 5;
    }

    // Late fee warning
    if (data.late_fee_applied) {
      doc.setTextColor(200, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(`Majoration de ${data.late_fee_percentage}% appliqu\u00E9e pour retard de paiement`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
    }

    // Bank details
    if (data.company.iban || data.company.bank_account_name) {
      y += 2;
      doc.setFontSize(8);
      doc.setTextColor(60);
      doc.text("Coordonn\u00E9es bancaires :", margin, y);
      y += 4;
      if (data.company.bank_account_name) {
        doc.text(`Titulaire : ${data.company.bank_account_name}`, margin + 3, y);
        y += 3.5;
      }
      if (data.company.iban) {
        doc.text(`IBAN : ${data.company.iban}`, margin + 3, y);
        y += 3.5;
      }
    }
  }

  // Payment method (for all statuses)
  if (data.payment_method && data.status !== "paid") {
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`Mode de paiement : ${PAYMENT_LABELS[data.payment_method] ?? data.payment_method}`, margin, y);
    y += 5;
  }

  /* ── PIED DE PAGE ── */

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

  // Bank info in footer if pending
  if (data.status !== "paid" && data.company.iban) {
    footerLines.push(`IBAN : ${data.company.iban}${data.company.bank_account_name ? ` \u2014 ${data.company.bank_account_name}` : ""}`);
  }

  let fy = footerY;
  for (const line of footerLines) {
    doc.text(line, pw / 2, fy, { align: "center", maxWidth: contentW });
    fy += 3.5;
  }

  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}
