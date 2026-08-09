import { describe, expect, it } from "vitest"
import { IsoDateSchema } from "../domain/values.ts"
import {
  createFixedProgramClock,
  createSeoulProgramClock,
  formatKoreanDate,
  formatKoreanDueDate,
  formatKoreanProgramRange,
} from "./program-clock.ts"

describe("ProgramClock", () => {
  it("uses the configured calendar day when the preview clock is fixed", () => {
    // Given
    const configuredDate = IsoDateSchema.parse("2026-08-31")
    const clock = createFixedProgramClock(configuredDate)

    // When
    const today = clock.today()

    // Then
    expect(today).toBe(configuredDate)
    expect(formatKoreanDate(today, "full_with_weekday")).toBe("8월 31일 월요일")
  })

  it("rolls into the next Seoul calendar day when UTC is still on the prior day", () => {
    // Given
    const clock = createSeoulProgramClock(() => new Date("2026-08-09T15:30:00.000Z"))

    // When
    const today = clock.today()

    // Then
    expect(today).toBe("2026-08-10")
    expect(formatKoreanDate(today, "full_with_weekday")).toBe("8월 10일 월요일")
  })
})

describe("friendly Korean program dates", () => {
  it("formats due dates and program ranges without exposing storage ISO strings", () => {
    // Given
    const dueOn = "2026-08-31"
    const startsOn = "2026-08-24"
    const endsOn = "2026-10-24"

    // When
    const dueLabel = formatKoreanDueDate(dueOn)
    const rangeLabel = formatKoreanProgramRange(startsOn, endsOn)

    // Then
    expect(dueLabel).toBe("8월 31일까지")
    expect(rangeLabel).toBe("2026년 8월 24일 – 10월 24일")
    expect(`${dueLabel} ${rangeLabel}`).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it("uses a customer-safe fallback when a date crosses the UI boundary malformed", () => {
    // Given
    const malformedDate = "2026-99-99"

    // When
    const label = formatKoreanDueDate(malformedDate)

    // Then
    expect(label).toBe("기한 미정")
    expect(label).not.toContain(malformedDate)
  })
})
