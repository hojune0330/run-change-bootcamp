import { useLayoutEffect, useRef } from "react"
import type { MotionInsightViewModel } from "./models.ts"

export type { MotionInsightViewModel } from "./models.ts"

export type MotionInsightProps = {
  readonly insight: MotionInsightViewModel
}

export function MotionInsight({ insight }: MotionInsightProps) {
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (root === null) return

    const scroller = root.closest<HTMLElement>(".app-shell__main")
    if (scroller === null) return

    let disposed = false
    let revert: (() => void) | undefined

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return

        gsap.registerPlugin(ScrollTrigger)
        const media = gsap.matchMedia()
        media.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
          const context = gsap.context(() => {
            const styles = window.getComputedStyle(root)
            const chapterOffset = styles.getPropertyValue("--motion-insight-entry-offset").trim()

            gsap.fromTo(
              "[data-motion-insight-chapter]",
              { transform: `translateY(${chapterOffset})` },
              {
                transform: "translateY(0)",
                scrollTrigger: {
                  trigger: root,
                  scroller,
                  start: 0,
                  end: "max",
                  scrub: true,
                },
              },
            )
          }, root)

          return () => context.revert()
        })
        revert = () => media.revert()
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      revert?.()
    }
  }, [])

  return (
    <section aria-labelledby="motion-insight-title" className="motion-insight" ref={rootRef}>
      <header className="motion-insight__header">
        <div>
          <p className="motion-insight__eyebrow">THIS WEEK IN MOTION</p>
          <h2 id="motion-insight-title">이번 주 러닝 리듬</h2>
        </div>
        <p className="motion-insight__source">{insight.sourceLabel}</p>
      </header>
      <p className="motion-insight__period">{insight.periodLabel}</p>
      <ol className="motion-insight__chapters">
        {insight.chapters.map((chapter) => (
          <li data-motion-insight-chapter key={chapter.label}>
            <p>{chapter.label}</p>
            <strong>{chapter.value}</strong>
            <span>{chapter.description}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
