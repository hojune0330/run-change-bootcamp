import type { z } from "zod"
import { plusDays } from "./content-core"
import { type FeedPost, FeedPostSchema } from "./content-feed-post"
import type { IsoDateTimeSchema } from "./values"

export class FeedContentError extends Error {
  readonly code: "forbidden" | "invalid_transition"
  constructor(code: FeedContentError["code"]) {
    super(code)
    this.code = code
    this.name = "FeedContentError"
  }
}
export function editFeedPost(input: {
  readonly post: FeedPost
  readonly actorProfileId: string
  readonly body: string
  readonly editedAt: z.infer<typeof IsoDateTimeSchema>
}): FeedPost {
  if (input.post.authorId !== input.actorProfileId || input.post.deleteState !== "active")
    throw new FeedContentError("forbidden")
  return FeedPostSchema.parse({ ...input.post, body: input.body, editedAt: input.editedAt })
}
export function softDeleteFeedPost(input: {
  readonly post: FeedPost
  readonly actorProfileId: string
  readonly deletedAt: z.infer<typeof IsoDateTimeSchema>
}): FeedPost {
  if (input.post.authorId !== input.actorProfileId || input.post.deleteState !== "active")
    throw new FeedContentError("forbidden")
  return FeedPostSchema.parse({
    ...input.post,
    deleteState: "soft_deleted",
    deletedAt: input.deletedAt,
    purgeAfter: plusDays(input.deletedAt, 30),
  })
}
