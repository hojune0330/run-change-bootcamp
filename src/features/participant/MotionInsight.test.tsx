import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MotionInsight, type MotionInsightViewModel } from "./MotionInsight.tsx"

const INSIGHT = {
  sourceLabel: "시연용 합성 데이터",
  periodLabel: "2026년 8월 24일 – 8월 30일",
  chapters: [
    {
      label: "달린 횟수",
      value: "3회",
      description: "이번 주에 계획한 러닝을 세 번 기록했어요.",
    },
    {
      label: "누적 거리",
      value: "12.4 km",
      description: "지난주보다 2.1 km 더 달렸어요.",
    },
    {
      label: "다음 행동",
      value: "20분",
      description: "다음 러닝은 편안한 강도로 시작해요.",
    },
  ],
} satisfies MotionInsightViewModel

describe("MotionInsight", () => {
  it("renders a source-labelled weekly running story", () => {
    // Given
    render(<MotionInsight insight={INSIGHT} />)

    // When
    const story = screen.getByRole("region", { name: "이번 주 러닝 리듬" })

    // Then
    expect(story).toHaveTextContent(INSIGHT.sourceLabel)
    expect(story).toHaveTextContent(INSIGHT.periodLabel)
    for (const chapter of INSIGHT.chapters) {
      expect(story).toHaveTextContent(chapter.label)
      expect(story).toHaveTextContent(chapter.value)
      expect(story).toHaveTextContent(chapter.description)
    }
  })
})
