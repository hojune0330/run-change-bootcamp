import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ParticipantDetail } from "./ParticipantDetail.tsx"
import { PARTICIPANT_DETAIL } from "./test-fixtures.ts"

describe("participant drill-down privacy", () => {
  it("reveals granted metrics and keeps revoked metrics private", () => {
    // Given
    render(<ParticipantDetail participant={PARTICIPANT_DETAIL} />)

    // When
    const stakeholderView = screen.getByRole("region", { name: "관계자 공유 범위" })

    // Then
    expect(stakeholderView).toHaveTextContent("72 bpm")
    expect(stakeholderView).toHaveTextContent("공유 철회")
    expect(screen.getByRole("list", { name: "접근 감사 기록" })).toBeInTheDocument()
  })

  it("prompts for selection when no participant is active", () => {
    // Given
    render(<ParticipantDetail />)

    // When
    const status = screen.getByRole("status")

    // Then
    expect(status).toBeVisible()
  })
})
