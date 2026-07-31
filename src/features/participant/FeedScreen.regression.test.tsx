import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FeedScreen } from "./FeedScreen.tsx"
import type { FeedHandlers, FeedViewModel } from "./models.ts"
import type { ShareServices } from "./share.ts"

const feedModel = (
  heartCount: number,
  isHearted: boolean,
  comments: FeedViewModel["posts"][number]["comments"] = [],
): FeedViewModel => ({
  posts: [
    {
      id: "post-regression",
      authorName: "박러너님",
      body: "아침 달리기를 마쳤어요.",
      createdLabel: "방금",
      heartCount,
      isHearted,
      comments,
      shareUrl: "https://run.change/feed/post-regression",
    },
  ],
})

const shareServices = (): ShareServices => ({
  nativeShare: vi.fn(async () => ({ kind: "success" }) as const),
  writeClipboard: vi.fn(async () => ({ kind: "success" }) as const),
})

const handlers = (): FeedHandlers => ({
  onHeart: vi.fn(async () => ({ kind: "success" }) as const),
  onComment: vi.fn(async () => ({ kind: "success" }) as const),
})

describe("FeedScreen regressions", () => {
  it("retires optimistic reactions after authoritative post versions while preserving a draft", async () => {
    // Given
    const user = userEvent.setup()
    const feedHandlers = handlers()
    const services = shareServices()
    const initialModel = feedModel(2, false)
    const { rerender } = render(
      <FeedScreen
        handlers={feedHandlers}
        onRetry={vi.fn()}
        shareServices={services}
        state={{ status: "ready", data: initialModel }}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "하트 2" }))
    await user.type(screen.getByLabelText("댓글"), "등록할 댓글")
    await user.click(screen.getByRole("button", { name: "댓글 등록" }))
    await user.type(screen.getByLabelText("댓글"), "작성 중인 댓글")

    // Then
    expect(screen.getByRole("button", { name: "하트 3" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "댓글 1" })).toBeInTheDocument()

    // When an unrelated parent render reuses the same authoritative snapshot
    rerender(
      <FeedScreen
        handlers={feedHandlers}
        onRetry={vi.fn()}
        shareServices={services}
        state={{ status: "ready", data: initialModel }}
      />,
    )

    // Then optimistic values and the intentional draft remain visible
    expect(screen.getByRole("button", { name: "하트 3" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "댓글 1" })).toBeInTheDocument()
    expect(screen.getByLabelText("댓글")).toHaveValue("작성 중인 댓글")

    // When the server acknowledges both optimistic values
    rerender(
      <FeedScreen
        handlers={feedHandlers}
        onRetry={vi.fn()}
        shareServices={services}
        state={{
          status: "ready",
          data: feedModel(9, true, [
            { id: "comment-server", authorName: "서버 러너", body: "새 댓글" },
          ]),
        }}
      />,
    )

    // Then
    expect(screen.getByRole("button", { name: "하트 9" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "댓글 1" })).toBeInTheDocument()
    expect(screen.getByText("새 댓글")).toBeInTheDocument()
    expect(screen.getByLabelText("댓글")).toHaveValue("작성 중인 댓글")

    // When a newer authoritative post rolls both values back
    rerender(
      <FeedScreen
        handlers={feedHandlers}
        onRetry={vi.fn()}
        shareServices={services}
        state={{ status: "ready", data: feedModel(2, false) }}
      />,
    )

    // Then retired optimistic values cannot reappear, while the draft remains
    expect(screen.getByRole("button", { name: "하트 2" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "댓글 0" })).toBeInTheDocument()
    expect(screen.queryByText("새 댓글")).not.toBeInTheDocument()
    expect(screen.getByLabelText("댓글")).toHaveValue("작성 중인 댓글")
  })

  it("recovers after a rejected heart request", async () => {
    // Given
    const user = userEvent.setup()
    let attempt = 0
    const onHeart = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("heart failed")
      return { kind: "success" } as const
    })
    render(
      <FeedScreen
        handlers={{ onHeart, onComment: handlers().onComment }}
        onRetry={vi.fn()}
        shareServices={shareServices()}
        state={{ status: "ready", data: feedModel(2, false) }}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "하트 2" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("반응을 남기지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("button", { name: "하트 2" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "하트 2" }))

    // Then
    expect(onHeart).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "하트 3" })).toHaveAttribute("aria-pressed", "true")
  })

  it("preserves a comment and recovers after its request rejects", async () => {
    // Given
    const user = userEvent.setup()
    let attempt = 0
    const onComment = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("comment failed")
      return { kind: "success" } as const
    })
    render(
      <FeedScreen
        handlers={{ onHeart: handlers().onHeart, onComment }}
        onRetry={vi.fn()}
        shareServices={shareServices()}
        state={{ status: "ready", data: feedModel(2, false) }}
      />,
    )
    await user.type(screen.getByLabelText("댓글"), "회복 댓글")

    // When
    await user.click(screen.getByRole("button", { name: "댓글 등록" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("댓글을 등록하지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByLabelText("댓글")).toHaveValue("회복 댓글")
    expect(screen.getByRole("button", { name: "댓글 등록" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "댓글 등록" }))

    // Then
    expect(onComment).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText("댓글")).toHaveValue("")
    expect(screen.getByRole("button", { name: "댓글 1" })).toBeInTheDocument()
  })

  it("recovers after native sharing rejects", async () => {
    // Given
    const user = userEvent.setup()
    let attempt = 0
    const nativeShare = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("share failed")
      return { kind: "success" } as const
    })
    render(
      <FeedScreen
        handlers={handlers()}
        onRetry={vi.fn()}
        shareServices={{ nativeShare, writeClipboard: shareServices().writeClipboard }}
        state={{ status: "ready", data: feedModel(2, false) }}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "공유" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("공유하지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("button", { name: "공유" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "공유" }))

    // Then
    expect(nativeShare).toHaveBeenCalledTimes(2)
    expect(screen.getByText("기록을 공유했어요.")).toBeInTheDocument()
  })
})
