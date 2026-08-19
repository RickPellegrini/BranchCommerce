import { describe, expect, it } from "vitest"

import {
  calculateBranchHunterProfit,
  createDefaultBranchHunterOperationSettings,
} from "./branch-hunter-profit"

describe("calculateBranchHunterProfit", () => {
  it("keeps Centralize and Full mutually exclusive when both are provided", () => {
    const result = calculateBranchHunterProfit(
      {
        salePrice: 100,
        saleFeePercent: 12,
      },
      {
        ...createDefaultBranchHunterOperationSettings(),
        productCost: 20,
        centralizeEnabled: true,
        fullEnabled: true,
        fullShipmentUnits: 100,
        fullCollectionCost: 100,
      },
    )

    expect(result.centralizeFixedCosts).toBe(0)
    expect(result.fullUnitCost).toBe(2)
    expect(result.fullCollectionUnitCost).toBe(1)
    expect(result.fullCosts).toBe(3)
  })

  it("applies Centralize fixed costs only when Centralize mode is active", () => {
    const result = calculateBranchHunterProfit(
      {
        salePrice: 100,
        saleFeePercent: 12,
      },
      {
        ...createDefaultBranchHunterOperationSettings(),
        productCost: 20,
        centralizeEnabled: true,
        fullEnabled: false,
      },
    )

    expect(result.centralizeFixedCosts).toBe(6.5)
    expect(result.fullCosts).toBe(0)
  })
})
