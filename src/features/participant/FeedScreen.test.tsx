import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FeedScreen } from "./FeedScreen.tsx"
import type { FeedHandlers, FeedViewModel } from "./models.ts"
import type { ShareServices } from "./share.ts"

const FEED_MODEL = {
  posts: [
    {
      id: "post-morning-run",
      authorName: "박아주긴한글이름을가진러너입니다님",
      body: "아침에 20분 천천히 달렸어요.",
      createdLabel: "10분 전",
      heartCount: 2,
      isHearted: false,
      comments: [],
      shareUrl: "https://run.change/feed/post-morning-run",
    },
  ],
} satisfies FeedViewModel

const createHandlers = (): FeedHandlers => ({
  onHeart: vi.fn(async () => ({ kind: "success" }) as const),
  onComment: vi.fn(async () => ({ kind: "success" }) as const),
})

const createShareServices = (): ShareServices => ({
  nativeShare: vi.fn(async () => ({ kind: "success" }) as const),
  writeClipboard: vi.fn(async () => ({ kind: "success" }) as const),
})

describe("FeedScreen", () => {
  it("records one heart when the heart control receives a duplicate activation", async () => {
    // Given
    const user = userEvent.setup()
    const handlers = createHandlers()
    render(
      <FeedScreen
        handlers={handlers}
        onRetry={vi.fn()}
        shareServices={createShareServices()}
        state={{ status: "ready", data: FEED_MODEL }}
      />,
    )

    // When
    await user.dblClick(screen.getByRole("button", { name: "하트 2" }))

    // Then
    expect(handlers.onHeart).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "하트 3" })).toHaveAttribute("aria-pressed", "true")
  })

  it("does not submit an empty comment", async () => {
    // Given
    const user = userEvent.setup()
    const handlers = createHandlers()
    render(
      <FeedScreen
        handlers={handlers}
        onRetry={vi.fn()}
        shareServices={createShareServices()}
        state={{ status: "ready", data: FEED_MODEL }}
      />,
    )

    // When
    await user.type(screen.getByLabelText("댓글"), "   ")

    // Then
    expect(screen.getByRole("button", { name: "댓글 등록" })).toBeDisabled()
    expect(handlers.onComment).not.toHaveBeenCalled()
    expect(screen.getByText("첫 댓글을 남겨보세요.")).toBeInTheDocument()
  })

  it("falls back to the clipboard when native sharing is denied", async () => {
    // Given
    const user = userEvent.setup()
    const shareServices = {
      nativeShare: vi.fn(async () => ({ kind: "denied" }) as const),
      writeClipboard: vi.fn(async () => ({ kind: "success" }) as const),
    } satisfies ShareServices
    render(
      <FeedScreen
        handlers={createHandlers()}
        onRetry={vi.fn()}
        shareServices={shareServices}
        state={{ status: "ready", data: FEED_MODEL }}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "공유" }))

    // Then
    expect(shareServices.writeClipboard).toHaveBeenCalledOnce()
    expect(screen.getByText("공유 링크를 복사했어요.")).toBeInTheDocument()
  })

  it("shows an empty state when the cohort has no posts", () => {
    // Given / When
    render(
      <FeedScreen
        handlers={createHandlers()}
        onRetry={vi.fn()}
        shareServices={createShareServices()}
        state={{ status: "ready", data: { posts: [] } }}
      />,
    )

    // Then
    expect(screen.getByText("아직 공유된 기록이 없어요.")).toBeInTheDocument()
  })
})
