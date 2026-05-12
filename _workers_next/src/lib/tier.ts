export type Tier = "LV0" | "LV1" | "LV2";

export function computeTier(
  monthlyLdc: number,
  tier1Threshold: number,
  tier2Threshold: number,
): Tier {
  if (monthlyLdc >= tier2Threshold) {
    return "LV2";
  }
  if (monthlyLdc >= tier1Threshold) {
    return "LV1";
  }
  return "LV0";
}
