import { Card } from "../../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import { FeedPostCard } from "./FeedPostCard.tsx"
import { LoadableBoundary } from "./LoadableBoundary.tsx"
import type { FeedHandlers, FeedViewModel, Loadable } from "./models.ts"
import type { ShareServices } from "./share.ts"
import "./participant.css"

export type FeedScreenProps = {
  readonly brand?: BrandConfig
  readonly state: Loadable<FeedViewModel>
  readonly handlers: FeedHandlers
  readonly shareServices: ShareServices
  readonly onRetry: () => void
}

export function FeedScreen({
  brand = DEFAULT_BRAND,
  state,
  handlers,
  shareServices,
  onRetry,
}: FeedScreenProps) {
  return (
    <section aria-labelledby="participant-feed-title" className="participant-screen">
      <header className="participant-screen__header">
        <p className="participant-screen__eyebrow">{brand.productName} · 함께 달리는 기록</p>
        <h1 id="participant-feed-title">함께</h1>
        <p>서로의 완료 기록만 보고 가벼운 응원을 남겨요.</p>
      </header>
      <LoadableBoundary onRetry={onRetry} state={state}>
        {(model) =>
          model.posts.length === 0 ? (
            <Card eyebrow="COHORT FEED" title="첫 기록을 기다려요" tone="muted">
              <p className="participant-empty-copy">아직 공유된 기록이 없어요.</p>
            </Card>
          ) : (
            <div className="participant-feed-list">
              {model.posts.map((post) => (
                <FeedPostCard
                  brand={brand}
                  handlers={handlers}
                  key={post.id}
                  post={post}
                  shareServices={shareServices}
                />
              ))}
            </div>
          )
        }
      </LoadableBoundary>
    </section>
  )
}
