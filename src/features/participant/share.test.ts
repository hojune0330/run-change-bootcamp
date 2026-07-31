import { describe, expect, it, vi } from "vitest"
import { type SharePayload, type ShareServices, shareParticipantPost } from "./share.ts"

const PAYLOAD = {
  title: "RUN CHANGE",
  text: "오늘의 달리기",
  url: "https://run.change/feed/post-one",
} satisfies SharePayload

describe("shareParticipantPost", () => {
  it("uses native sharing when it succeeds", async () => {
    // Given
    const services = {
      nativeShare: vi.fn(async () => ({ kind: "success" }) as const),
      writeClipboard: vi.fn(async () => ({ kind: "success" }) as const),
    } satisfies ShareServices

    // When
    const result = await shareParticipantPost(PAYLOAD, services)

    // Then
    expect(result).toEqual({ kind: "native" })
    expect(services.writeClipboard).not.toHaveBeenCalled()
  })

  it("reports unavailable when sharing and clipboard access are both denied", async () => {
    // Given
    const services = {
      nativeShare: vi.fn(async () => ({ kind: "denied" }) as const),
      writeClipboard: vi.fn(async () => ({ kind: "denied" }) as const),
    } satisfies ShareServices

    // When
    const result = await shareParticipantPost(PAYLOAD, services)

    // Then
    expect(result).toEqual({ kind: "unavailable" })
  })
})
