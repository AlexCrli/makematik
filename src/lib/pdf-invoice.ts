import { jsPDF } from "jspdf";

interface InvoicePdfData {
  invoice_number: string;
  created_at: string;
  status: string;
  payment_method: string | null;
  payment_date: string | null;
  payment_due_date: string | null;
  late_fee_percentage: number;
  total_ht: number;
  tva_rate: number;
  total_tva: number;
  total_ttc: number;
  tax_credit_applicable: boolean;
  tax_credit_amount: number;
  client: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
  };
  company: { name: string } | null;
  lines: { label: string; quantity: number; unit_price: number; total_ht: number }[];
}

const COMPANY_INFO: Record<string, { address: string; siret: string }> = {
  NetVapeur: { address: "123 Rue de la Vapeur, 75001 Paris", siret: "SIRET: 123 456 789 00001" },
  "Clim Eco Pro": { address: "45 Avenue du Froid, 13001 Marseille", siret: "SIRET: 987 654 321 00001" },
  Clim50: { address: "12 Rue des Splits, 50000 Saint-L\u00F4", siret: "SIRET: 456 789 123 00001" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Esp\u00E8ces", check: "Ch\u00E8que", card: "CB", deferred: "Virement / facture diff\u00E9r\u00E9e",
};

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtDate(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function generateInvoicePdf(data: InvoicePdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const margin = 20;
  const contentW = pw - 2 * margin;
  let y = 20;

  const companyName = data.company?.name ?? "Makematik";
  const info = COMPANY_INFO[companyName] ?? { address: "", siret: "" };

  // Company header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  if (info.address) { doc.text(info.address, margin, y); y += 4; }
  if (info.siret) { doc.text(info.siret, margin, y); y += 4; }
  y += 4;

  // Invoice number + date
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`FACTURE ${data.invoice_number}`, pw - margin, 20, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Date : ${fmtDate(data.created_at)}`, pw - margin, 28, { align: "right" });

  if (data.status === "paid" && data.payment_date) {
    doc.setTextColor(0, 128, 0);
    doc.text(`Acquitt\u00E9e le ${fmtDate(data.payment_date)}`, pw - margin, 33, { align: "right" });
  } else if (data.payment_due_date) {
    doc.setTextColor(200, 100, 0);
    doc.text(`\u00C9ch\u00E9ance : ${fmtDate(data.payment_due_date)}`, pw - margin, 33, { align: "right" });
  }

  // Separator
  doc.setDrawColor(200);
  doc.setTextColor(0);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Client info
  doc.setTextColor(100);
  doc.setFontSize(9);
  doc.text("FACTURER \u00C0", margin, y);
  y += 5;
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.client.first_name} ${data.client.last_name}`, margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addrParts = [data.client.address, data.client.postal_code, data.client.city].filter(Boolean);
  if (addrParts.length) { doc.text(addrParts.join(", "), margin, y); y += 4; }
  if (data.client.email) { doc.text(data.client.email, margin, y); y += 4; }
  if (data.client.phone) { doc.text(data.client.phone, margin, y); y += 4; }
  y += 8;

  // Table
  const colR = pw - margin;

  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y - 1, contentW, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("Libell\u00E9", margin + 2, y + 4);
  doc.text("Qt\u00E9", margin + contentW * 0.5 + 2, y + 4);
  doc.text("Prix unit.", margin + contentW * 0.65 + 2, y + 4);
  doc.text("Total HT", colR - 2, y + 4, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.setFontSize(9);
  for (const line of data.lines) {
    doc.text(line.label.slice(0, 50), margin + 2, y + 4);
    doc.text(String(line.quantity), margin + contentW * 0.5 + 2, y + 4);
    doc.text(fmtEur(line.unit_price), margin + contentW * 0.65 + 2, y + 4);
    doc.text(fmtEur(line.total_ht), colR - 2, y + 4, { align: "right" });
    doc.setDrawColor(230);
    doc.line(margin, y + 7, pw - margin, y + 7);
    y += 9;
    if (y > 260) { doc.addPage(); y = 20; }
  }

  y += 6;

  // Totals
  const totX = margin + contentW * 0.6;
  doc.setFontSize(9);
  doc.text("Total HT", totX, y); doc.text(fmtEur(data.total_ht), colR - 2, y, { align: "right" }); y += 5;
  doc.text(`TVA ${data.tva_rate}%`, totX, y); doc.text(fmtEur(data.total_tva), colR - 2, y, { align: "right" }); y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total TTC", totX, y); doc.text(fmtEur(data.total_ttc), colR - 2, y, { align: "right" }); y += 6;

  if (data.tax_credit_applicable && data.tax_credit_amount > 0) {
    doc.setFontSize(9);
    doc.setTextColor(0, 128, 0);
    doc.text("Cr\u00E9dit d'imp\u00F4t 50%", totX, y);
    doc.text(`-${fmtEur(data.tax_credit_amount)}`, colR - 2, y, { align: "right" });
    y += 5;
    doc.text("Reste \u00E0 charge", totX, y);
    doc.text(fmtEur(data.total_ttc - data.tax_credit_amount), colR - 2, y, { align: "right" });
    y += 6;
  }

  // Payment info
  y += 4;
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (data.payment_method) {
    doc.text(`Mode de paiement : ${PAYMENT_LABELS[data.payment_method] ?? data.payment_method}`, margin, y);
    y += 5;
  }

  // Footer
  y = Math.max(y + 10, 250);
  doc.setTextColor(130);
  doc.setFontSize(8);
  if (data.payment_due_date && data.status !== "paid") {
    doc.text(`\u00C9ch\u00E9ance de paiement : ${fmtDate(data.payment_due_date)}. En cas de non-paiement dans les d\u00E9lais, une majoration de ${data.late_fee_percentage}% sera appliqu\u00E9e.`, margin, y);
    y += 4;
  }
  doc.text("En cas de retard de paiement, des p\u00E9nalit\u00E9s de retard seront exigibles conform\u00E9ment \u00E0 l'article L.441-10 du Code de commerce.", margin, y, { maxWidth: contentW });

  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}
