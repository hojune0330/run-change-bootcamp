import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MyChangeScreen } from "./MyChangeScreen.tsx"
import type {
  ConsentChangeRequest,
  ConsentChangeResult,
  MyChangeHandlers,
  MyChangeViewModel,
} from "./models.ts"

const CHANGE_MODEL = {
  displayName: "이정말긴이름을가진참여자의변화기록입니다님",
  metrics: [
    { id: "metric-distance", label: "주간 거리", value: "12.4 km", changeLabel: "+2.1 km" },
  ],
  feedback: [
    {
      id: "feedback-auto",
      source: "automated_summary",
      title: "주간 요약",
      body: "기록 빈도가 안정적이에요.",
    },
    {
      id: "feedback-coach",
      source: "coach_approved",
      title: "코치 피드백",
      body: "다음 주도 같은 강도로 진행해요.",
    },
  ],
  consents: [
    {
      key: "consent-resting-heart-rate",
      label: "안정 시 심박수",
      description: "코치에게만 공유해요.",
    },
    {
      key: "consent-sleep",
      label: "수면 시간",
      description: "프로그램 요약에 사용해요.",
    },
  ],
  consentHistory: [],
} satisfies MyChangeViewModel

describe("MyChangeScreen", () => {
  it("keeps every health sharing control off by default", () => {
    // Given / When
    render(
      <MyChangeScreen
        handlers={{ onConsentChange: vi.fn() }}
        onRetry={vi.fn()}
        state={{ status: "ready", data: CHANGE_MODEL }}
      />,
    )

    // Then
    const controls = screen.getAllByRole("switch")
    expect(controls).toHaveLength(2)
    for (const control of controls) {
      expect(control).toHaveAttribute("aria-checked", "false")
    }
  })

  it("records consent activation and revocation in visible history", async () => {
    // Given
    const user = userEvent.setup()
    const onConsentChange = vi.fn(
      async (request: ConsentChangeRequest): Promise<ConsentChangeResult> => ({
        kind: "success",
        auditEntry: {
          id: request.enabled ? "audit-enabled" : "audit-revoked",
          label: request.enabled ? "안정 시 심박수 공유 허용" : "안정 시 심박수 공유 철회",
        },
      }),
    )
    const handlers = { onConsentChange } satisfies MyChangeHandlers
    render(
      <MyChangeScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: CHANGE_MODEL }}
      />,
    )
    const control = screen.getByRole("switch", { name: "안정 시 심박수" })

    // When
    await user.click(control)
    await user.click(control)

    // Then
    expect(onConsentChange).toHaveBeenNthCalledWith(1, {
      key: "consent-resting-heart-rate",
      enabled: true,
    })
    expect(onConsentChange).toHaveBeenNthCalledWith(2, {
      key: "consent-resting-heart-rate",
      enabled: false,
    })
    const history = screen.getByRole("region", { name: "공유 변경 기록" })
    expect(within(history).getByText("안정 시 심박수 공유 철회")).toBeInTheDocument()
  })

  it("clearly distinguishes automated and coach-approved feedback", () => {
    // Given / When
    render(
      <MyChangeScreen
        handlers={{ onConsentChange: vi.fn() }}
        onRetry={vi.fn()}
        state={{ status: "ready", data: CHANGE_MODEL }}
      />,
    )

    // Then
    expect(screen.getByText("자동 요약")).toBeInTheDocument()
    expect(screen.getByText("훈련 변경 제안이 아니에요.")).toBeInTheDocument()
    expect(screen.getByText("코치 승인")).toBeInTheDocument()
  })

  it("renders metric and feedback empty states without hiding consent controls", () => {
    // Given
    const emptyModel = { ...CHANGE_MODEL, metrics: [], feedback: [] } satisfies MyChangeViewModel

    // When
    render(
      <MyChangeScreen
        handlers={{ onConsentChange: vi.fn() }}
        onRetry={vi.fn()}
        state={{ status: "ready", data: emptyModel }}
      />,
    )

    // Then
    expect(screen.getByText("아직 비교할 기록이 없어요.")).toBeInTheDocument()
    expect(screen.getByText("아직 받은 피드백이 없어요.")).toBeInTheDocument()
    expect(screen.getAllByRole("switch")).toHaveLength(2)
  })
})
