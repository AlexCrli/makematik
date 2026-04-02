import { jsPDF } from "jspdf";

interface QuotePdfData {
  quote_number: string;
  created_at: string;
  sent_at: string | null;
  total_ht: number;
  tva_rate: number;
  total_ttc: number;
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
  lines: { label: string; quantity: number; unit_price_ht: number; total_ht: number }[];
}

const COMPANY_INFO: Record<string, { address: string; siret: string }> = {
  NetVapeur: { address: "123 Rue de la Vapeur, 75001 Paris", siret: "SIRET: 123 456 789 00001" },
  "Clim Eco Pro": { address: "45 Avenue du Froid, 13001 Marseille", siret: "SIRET: 987 654 321 00001" },
  Clim50: { address: "12 Rue des Splits, 50000 Saint-Lô", siret: "SIRET: 456 789 123 00001" },
};

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtDate(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function generateQuotePdf(data: QuotePdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const margin = 20;
  const contentW = pw - 2 * margin;
  let y = 20;

  // Company header
  const companyName = data.company?.name ?? "Makematik";
  const info = COMPANY_INFO[companyName] ?? { address: "", siret: "" };

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

  // Quote number + dates (right-aligned)
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`DEVIS ${data.quote_number}`, pw - margin, 20, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Date : ${fmtDate(data.created_at)}`, pw - margin, 28, { align: "right" });
  if (data.sent_at) {
    doc.text(`Envoy\u00E9 le : ${fmtDate(data.sent_at)}`, pw - margin, 33, { align: "right" });
  }

  // Separator
  doc.setDrawColor(200);
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

  // Table header
  const colX = [margin, margin + contentW * 0.5, margin + contentW * 0.65, margin + contentW * 0.8];
  const colR = pw - margin;

  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y - 1, contentW, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("Libell\u00E9", colX[0] + 2, y + 4);
  doc.text("Qt\u00E9", colX[1] + 2, y + 4);
  doc.text("Prix unit. HT", colX[2] + 2, y + 4);
  doc.text("Total HT", colR - 2, y + 4, { align: "right" });
  y += 10;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.setFontSize(9);
  for (const line of data.lines) {
    doc.text(line.label.slice(0, 50), colX[0] + 2, y + 4);
    doc.text(String(line.quantity), colX[1] + 2, y + 4);
    doc.text(fmtEur(line.unit_price_ht), colX[2] + 2, y + 4);
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
  const tvaAmt = data.total_ht * (data.tva_rate / 100);
  doc.text(`TVA ${data.tva_rate}%`, totX, y); doc.text(fmtEur(tvaAmt), colR - 2, y, { align: "right" }); y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total TTC", totX, y); doc.text(fmtEur(data.total_ttc), colR - 2, y, { align: "right" }); y += 6;

  if (data.tax_credit_amount > 0) {
    doc.setFontSize(9);
    doc.setTextColor(0, 128, 0);
    doc.text("Cr\u00E9dit d'imp\u00F4t 50%", totX, y);
    doc.text(`-${fmtEur(data.tax_credit_amount)}`, colR - 2, y, { align: "right" });
    y += 5;
    doc.text("Reste \u00E0 charge", totX, y);
    doc.text(fmtEur(data.total_ttc - data.tax_credit_amount), colR - 2, y, { align: "right" });
    y += 6;
  }

  // Footer
  y = Math.max(y + 15, 250);
  doc.setTextColor(130);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Devis valable 30 jours \u00E0 compter de la date d'\u00E9mission.", margin, y);
  y += 4;
  doc.text("Conditions de paiement : \u00E0 la fin de l'intervention, par esp\u00E8ces, ch\u00E8que ou CB.", margin, y);

  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}
