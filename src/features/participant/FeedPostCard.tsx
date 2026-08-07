import { ChatCircleIcon } from "@phosphor-icons/react/ChatCircle"
import { HeartIcon } from "@phosphor-icons/react/Heart"
import { ShareNetworkIcon } from "@phosphor-icons/react/ShareNetwork"
import { type FormEvent, type MouseEvent, useId, useRef, useState } from "react"
import { Button, Card } from "../../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import { ActionFeedback } from "./ActionFeedback.tsx"
import { type ActionFeedbackState, rejectedActionFeedback } from "./action-feedback-state.ts"
import { assertParticipantNever, type FeedHandlers, type FeedPostViewModel } from "./models.ts"
import { type ShareServices, shareParticipantPost } from "./share.ts"

type FeedPostCardProps = {
  readonly brand?: BrandConfig
  readonly handlers: FeedHandlers
  readonly post: FeedPostViewModel
  readonly shareServices: ShareServices
}

type HeartUpdate = {
  readonly postId: FeedPostViewModel["id"]
  readonly sourceCount: number
  readonly sourceHearted: boolean
  readonly count: number
  readonly hearted: boolean
}

type CommentCountUpdate = {
  readonly postId: FeedPostViewModel["id"]
  readonly sourceCount: number
  readonly count: number
}

export function FeedPostCard({
  brand = DEFAULT_BRAND,
  handlers,
  post,
  shareServices,
}: FeedPostCardProps) {
  const commentId = useId()
  const [heartUpdate, setHeartUpdate] = useState<HeartUpdate>()
  const [commentCountUpdate, setCommentCountUpdate] = useState<CommentCountUpdate>()
  const [comment, setComment] = useState("")
  const [heartBusy, setHeartBusy] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedbackState>()
  const heartPending = useRef(false)
  const commentPending = useRef(false)
  const sharePending = useRef(false)
  const trimmedComment = comment.trim()
  const hasCurrentHeartUpdate =
    heartUpdate?.postId === post.id &&
    heartUpdate.sourceCount === post.heartCount &&
    heartUpdate.sourceHearted === post.isHearted
  if (heartUpdate !== undefined && !hasCurrentHeartUpdate) {
    setHeartUpdate(undefined)
  }
  const hearted = hasCurrentHeartUpdate ? heartUpdate.hearted : post.isHearted
  const heartCount = hasCurrentHeartUpdate ? heartUpdate.count : post.heartCount
  const hasCurrentCommentCountUpdate =
    commentCountUpdate?.postId === post.id &&
    commentCountUpdate.sourceCount === post.comments.length
  if (commentCountUpdate !== undefined && !hasCurrentCommentCountUpdate) {
    setCommentCountUpdate(undefined)
  }
  const commentCount = hasCurrentCommentCountUpdate
    ? commentCountUpdate.count
    : post.comments.length

  const toggleHeart = async (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail > 1 || heartPending.current) {
      return
    }
    heartPending.current = true
    setHeartBusy(true)
    const nextHearted = !hearted
    try {
      const result = await handlers.onHeart(post.id, nextHearted)
      switch (result.kind) {
        case "success":
          setHeartUpdate({
            postId: post.id,
            sourceCount: post.heartCount,
            sourceHearted: post.isHearted,
            count: Math.max(0, heartCount + (nextHearted ? 1 : -1)),
            hearted: nextHearted,
          })
          break
        case "error":
          setFeedback({ kind: "error", message: result.message })
          break
        default:
          assertParticipantNever(result)
      }
    } catch (error: unknown) {
      const actionError = error instanceof Error ? error : undefined
      setFeedback(
        rejectedActionFeedback(actionError, "반응을 남기지 못했어요. 다시 시도해 주세요."),
      )
    } finally {
      heartPending.current = false
      setHeartBusy(false)
    }
  }

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (commentPending.current || trimmedComment.length === 0) {
      return
    }
    commentPending.current = true
    setCommentBusy(true)
    try {
      const result = await handlers.onComment(post.id, trimmedComment)
      switch (result.kind) {
        case "success":
          setComment("")
          setCommentCountUpdate({
            postId: post.id,
            sourceCount: post.comments.length,
            count: commentCount + 1,
          })
          setFeedback({ kind: "status", message: "댓글을 등록했어요." })
          break
        case "error":
          setFeedback({ kind: "error", message: result.message })
          break
        default:
          assertParticipantNever(result)
      }
    } catch (error: unknown) {
      const actionError = error instanceof Error ? error : undefined
      setFeedback(
        rejectedActionFeedback(actionError, "댓글을 등록하지 못했어요. 다시 시도해 주세요."),
      )
    } finally {
      commentPending.current = false
      setCommentBusy(false)
    }
  }

  const sharePost = async () => {
    if (sharePending.current) {
      return
    }
    sharePending.current = true
    setShareBusy(true)
    try {
      const result = await shareParticipantPost(
        { title: brand.labels.share, text: `${post.authorName}: ${post.body}`, url: post.shareUrl },
        shareServices,
      )
      switch (result.kind) {
        case "native":
          setFeedback({ kind: "status", message: "기록을 공유했어요." })
          break
        case "clipboard":
          setFeedback({ kind: "status", message: "공유 링크를 복사했어요." })
          break
        case "unavailable":
          setFeedback({ kind: "error", message: "공유와 링크 복사를 사용할 수 없어요." })
          break
        default:
          assertParticipantNever(result)
      }
    } catch (error: unknown) {
      const actionError = error instanceof Error ? error : undefined
      setFeedback(rejectedActionFeedback(actionError, "공유하지 못했어요. 다시 시도해 주세요."))
    } finally {
      sharePending.current = false
      setShareBusy(false)
    }
  }

  return (
    <Card eyebrow={post.createdLabel} title={post.authorName}>
      <div className="participant-stack">
        <p className="participant-feed-body">{post.body}</p>
        <fieldset className="participant-feed-actions">
          <legend className="participant-visually-hidden">기록 반응</legend>
          <Button
            aria-label={`하트 ${heartCount}`}
            aria-pressed={hearted}
            busy={heartBusy}
            icon={<HeartIcon aria-hidden size={19} weight={hearted ? "fill" : "bold"} />}
            onClick={toggleHeart}
            variant="quiet"
          >
            {heartCount}
          </Button>
          <Button
            icon={<ChatCircleIcon aria-hidden size={19} weight="bold" />}
            onClick={() => document.getElementById(commentId)?.focus()}
            variant="quiet"
          >
            댓글 {commentCount}
          </Button>
          <Button
            busy={shareBusy}
            icon={<ShareNetworkIcon aria-hidden size={19} weight="bold" />}
            onClick={sharePost}
            variant="quiet"
          >
            공유
          </Button>
        </fieldset>

        <div className="participant-comments">
          {post.comments.length === 0 ? (
            <p className="participant-empty-copy">첫 댓글을 남겨보세요.</p>
          ) : (
            <ul className="participant-comment-list">
              {post.comments.map((item) => (
                <li key={item.id}>
                  <strong>{item.authorName}</strong>
                  <span>{item.body}</span>
                </li>
              ))}
            </ul>
          )}
          <form className="participant-comment-form" onSubmit={submitComment}>
            <label htmlFor={commentId}>댓글</label>
            <textarea
              id={commentId}
              onChange={(event) => setComment(event.currentTarget.value)}
              placeholder="응원 한마디를 남겨보세요"
              rows={2}
              value={comment}
            />
            <Button
              busy={commentBusy}
              disabled={trimmedComment.length === 0}
              type="submit"
              variant="secondary"
            >
              댓글 등록
            </Button>
          </form>
        </div>
        <ActionFeedback feedback={feedback} />
      </div>
    </Card>
  )
}
