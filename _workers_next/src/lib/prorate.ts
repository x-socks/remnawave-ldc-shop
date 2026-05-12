export function prorateRenewal(
  currentDaysLeft: number,
  oldRate: number,
  newRate: number,
  paymentLdc: number,
): number {
  const daysLeft = currentDaysLeft < 0 ? 0 : Math.trunc(currentDaysLeft);
  const previousRate = Math.trunc(oldRate);
  const nextRate = Math.trunc(newRate);
  const paidLdc = Math.trunc(paymentLdc);

  if (nextRate === 0) {
    throw new RangeError("newRate must be non-zero");
  }

  const paidDaysNumerator = 30 * paidLdc;

  if (previousRate <= 0 || daysLeft === 0) {
    return Math.floor(paidDaysNumerator / nextRate);
  }

  if (nextRate >= previousRate) {
    return Math.floor((daysLeft * previousRate + paidDaysNumerator) / nextRate);
  }

  return daysLeft + Math.floor(paidDaysNumerator / nextRate);
}
