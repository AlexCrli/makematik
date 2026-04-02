/* Recalculate quote totals after line changes */
// eslint-disable-next-line
export async function recalculateQuote(supabase: any, quoteId: string) {
  const { data: quote } = await supabase
    .from("quotes")
    .select("tva_rate, tax_credit_rate")
    .eq("id", quoteId)
    .single();

  const tvaRate = quote?.tva_rate ?? 20;
  const taxCreditRate = quote?.tax_credit_rate ?? 0;

  const { data: lines } = await supabase
    .from("quote_lines")
    .select("quantity, unit_price_ht")
    .eq("quote_id", quoteId);

  const totalHt = (lines ?? []).reduce(
    (sum: number, l: { quantity: number; unit_price_ht: number }) =>
      sum + l.quantity * l.unit_price_ht,
    0,
  );
  const totalTtc = totalHt * (1 + tvaRate / 100);
  const taxCreditAmount = totalTtc * (taxCreditRate / 100);

  await supabase
    .from("quotes")
    .update({ total_ht: totalHt, total_ttc: totalTtc, tax_credit_amount: taxCreditAmount })
    .eq("id", quoteId);

  return { total_ht: totalHt, total_ttc: totalTtc, tax_credit_amount: taxCreditAmount, tva_rate: tvaRate };
}
