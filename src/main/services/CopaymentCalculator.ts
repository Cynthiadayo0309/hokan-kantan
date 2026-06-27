export function roundCopaymentToTenYen(amount: number): number {
  return Math.round(amount / 10) * 10;
}

export function calculateCopayment(total: number, rate: "unset" | "10" | "20" | "30"): number | undefined {
  if (rate === "unset") return undefined;
  return roundCopaymentToTenYen(total * (Number(rate) / 100));
}
