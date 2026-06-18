export const FREQUENCIES = ["Monthly", "Annual", "Weekly", "Quarterly", "Bi-weekly"];

export function freqToMonthly(amount, freq) {
  switch (freq) {
    case "Monthly":   return amount;
    case "Annual":    return amount / 12;
    case "Weekly":    return (amount * 52.142857) / 12;
    case "Quarterly": return amount / 3;
    case "Bi-weekly": return (amount * 26.071429) / 12;
    default:          return amount;
  }
}

export function fmt(n) {
  if (!isFinite(n) || isNaN(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function computeHealthScore(totalIncome, totalExpenses, invest, emergencyMonths) {
  if (totalIncome <= 0) return null;
  const net = totalIncome - totalExpenses - invest;
  const savingsRate  = net / totalIncome;
  const investRate   = invest / totalIncome;
  const expenseRatio = totalExpenses / totalIncome;

  const savingsScore   = Math.round(Math.min(1, Math.max(0, savingsRate / 0.20)) * 25);
  const emergencyScore = Math.round(Math.min(1, emergencyMonths / 6) * 25);
  const investScore    = Math.round(Math.min(1, Math.max(0, investRate / 0.10)) * 25);
  const expenseScore   = Math.round(Math.min(1, Math.max(0, (0.90 - expenseRatio) / 0.40)) * 25);

  return {
    total: savingsScore + emergencyScore + investScore + expenseScore,
    breakdown: [
      {
        labelKey: "score_savingsRate", score: savingsScore,
        value: `${(savingsRate * 100).toFixed(0)}%`, target: "≥20%",
        noteKey: savingsScore < 25 ? "note_savings" : null,
        noteVars: { x: fmt(Math.max(0, totalIncome * 0.20 - net)) },
      },
      {
        labelKey: "score_emergencyFund", score: emergencyScore,
        value: emergencyMonths === 0 ? "None" : `${emergencyMonths}mo`, target: "6mo",
        noteKey: emergencyScore < 25 ? "note_emergency" : null,
        noteVars: { x: fmt(totalExpenses * 6) },
      },
      {
        labelKey: "score_investmentRate", score: investScore,
        value: `${(investRate * 100).toFixed(0)}%`, target: "≥10%",
        noteKey: investScore < 25 ? "note_invest" : null,
        noteVars: { x: fmt(Math.max(0, totalIncome * 0.10 - invest)) },
      },
      {
        labelKey: "score_expenseRatio", score: expenseScore,
        value: `${(expenseRatio * 100).toFixed(0)}%`, target: "≤50%",
        noteKey: expenseScore < 25 ? "note_expense" : null,
        noteVars: { p: (expenseRatio * 100).toFixed(0), x: fmt(Math.max(0, totalExpenses - totalIncome * 0.50)) },
      },
    ],
  };
}

export function scoreColor(score) {
  if (score >= 80) return "#34C759";
  if (score >= 60) return "#FF9500";
  if (score >= 40) return "#FF9500";
  return "#FF3B30";
}

export function scoreLabelKey(score) {
  if (score >= 80) return "scoreLabel_excellent";
  if (score >= 60) return "scoreLabel_good";
  if (score >= 40) return "scoreLabel_fair";
  return "scoreLabel_needsWork";
}

/** Safe parseFloat that returns `fallback` instead of snapping to 0 on empty/invalid input. */
export function parseAmount(value, fallback = 0) {
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}
