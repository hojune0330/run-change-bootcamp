import { describe, expect, it } from "vitest"
import { myChangeModel } from "./participant-models.ts"
import { createInitialDemoState } from "./seed.ts"

describe("participant change model", () => {
  it("uses a customer-facing source label for program completion", () => {
    // Given
    const state = createInitialDemoState()

    // When
    const model = myChangeModel(state, "participant-01")
    const completionMetric = model.metrics.find(
      (metric) => metric.id === "metric-program-completion",
    )

    // Then
    expect(completionMetric?.changeLabel).toBe("전체 과제 기준")
    expect(completionMetric?.changeLabel).not.toBe("시드 기준")
  })
})
