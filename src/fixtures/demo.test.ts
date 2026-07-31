import { describe, expect, it } from "vitest"
import { DEMO_PARTICIPANTS, DEMO_PROGRAM } from "./demo"

describe("demo fixtures", () => {
  it("provides exactly twenty uniquely identified participants", () => {
    // Given
    const participantIds = DEMO_PARTICIPANTS.map((participant) => participant.id)

    // When
    const uniqueIds = new Set(participantIds)

    // Then
    expect(DEMO_PARTICIPANTS).toHaveLength(20)
    expect(uniqueIds.size).toBe(20)
  })

  it("keeps optional participant data genuinely optional", () => {
    // Given
    const participants = DEMO_PARTICIPANTS

    // When
    const participantWithMissingCheckIn = participants.find(
      (participant) => !("latestCheckInAt" in participant),
    )

    // Then
    expect(participantWithMissingCheckIn).toBeDefined()
  })

  it("leaves the first time-trial decision pending", () => {
    // Given
    const timeTrial = DEMO_PROGRAM.initialTimeTrial

    // When
    const decisionStatus = timeTrial.status

    // Then
    expect(decisionStatus).toBe("pending")
  })
})
