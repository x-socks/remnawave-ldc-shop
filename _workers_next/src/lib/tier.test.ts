import { describe, expect, it } from "vitest";

import fixture from "../../test-fixtures/tier_fixtures.json";
import { computeTier } from "./tier";

describe("computeTier", () => {
  it("uses the expected fixture schema", () => {
    expect(fixture.schema_version).toBe(1);
    expect(fixture.source.startsWith("internal/")).toBe(true);
  });

  for (const testCase of fixture.cases) {
    it(testCase.name, () => {
      const { monthlyLDC, tier1Threshold, tier2Threshold } = testCase.input;

      expect(
        computeTier(monthlyLDC, tier1Threshold, tier2Threshold),
        testCase.name,
      ).toBe(testCase.expected.tier);
    });
  }
});
