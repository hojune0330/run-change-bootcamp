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
    expect(rangeLabel).toBe("2026년 8월 24일 – 10월 24일")
    expect(rangeLabel).not.toMatch(/\d{1,2}월 \d{1,2}일/)
    expect(`${dueLabel} ${rangeLabel}`).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it("includes the ending year when a program range crosses calendar years", () => {
    // Given
    const startsOn = "2026-12-24"
    const endsOn = "2027-01-24"

    // When
    const rangeLabel = formatKoreanProgramRange(startsOn, endsOn)

    // Then
    expect(rangeLabel).toBe("2026년 12월 24일 – 2027년 1월 24일")
  })

  it.each([
    ["UTC crossing into the next Seoul day", "2026-08-09T15:30:00.000Z", "8월 10일까지"],
    ["negative offset crossing forward", "2026-08-09T23:30:00-05:00", "8월 10일까지"],
    ["positive offset crossing backward", "2026-08-10T00:30:00+14:00", "8월 9일까지"],
    ["date-only Seoul calendar semantics", "2026-08-31", "8월 31일까지"],
  ])("formats %s before presenting a due date", (_scenario, value, expected) => {
    expect(formatKoreanDueDate(value)).toBe(expected)
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
