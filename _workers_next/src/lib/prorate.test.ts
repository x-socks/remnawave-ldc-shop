import { describe, expect, it } from "vitest";

import fixture from "../../test-fixtures/prorate_fixtures.json";
import { prorateRenewal } from "./prorate";

describe("prorateRenewal", () => {
  it("uses the expected fixture schema", () => {
    expect(fixture.schema_version).toBe(1);
    expect(fixture.source.startsWith("internal/")).toBe(true);
  });

  for (const testCase of fixture.cases) {
    it(testCase.name, () => {
      const { currentDaysLeft, oldRate, newRate, paymentLDC } = testCase.input;

      expect(
        prorateRenewal(currentDaysLeft, oldRate, newRate, paymentLDC),
        testCase.name,
      ).toBe(testCase.expected.newDays);
    });
  }
});
