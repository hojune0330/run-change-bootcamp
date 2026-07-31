import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MyChangeScreen } from "./MyChangeScreen.tsx"
import type { MyChangeHandlers, MyChangeViewModel } from "./models.ts"

const model = (
  enabled: boolean,
  consentHistory: MyChangeViewModel["consentHistory"] = [],
): MyChangeViewModel => ({
  displayName: "김러너님",
  metrics: [],
  feedback: [],
  consents: [
    {
      key: "consent-sleep",
      label: "수면 시간",
      description: "프로그램 요약에 사용해요.",
      enabled,
    },
  ],
  consentHistory,
})

describe("MyChangeScreen regressions", () => {
  it("retires an optimistic consent after authoritative consent versions", async () => {
    // Given
    const user = userEvent.setup()
    const handlers = {
      onConsentChange: vi.fn(
        async () =>
          ({
            kind: "success",
            auditEntry: { id: "audit-local", label: "로컬 공유 허용" },
          }) as const,
      ),
    } satisfies MyChangeHandlers
    const initialModel = model(false)
    const { rerender } = render(
      <MyChangeScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: initialModel }}
      />,
    )

    // When
    await user.click(screen.getByRole("switch", { name: "수면 시간" }))

    // Then
    expect(screen.getByRole("switch", { name: "수면 시간" })).toHaveAttribute(
      "aria-checked",
      "true",
    )

    // When an unrelated parent render reuses the same authoritative snapshot
    rerender(
      <MyChangeScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: initialModel }}
      />,
    )

    // Then the optimistic consent remains visible
    expect(screen.getByRole("switch", { name: "수면 시간" })).toHaveAttribute(
      "aria-checked",
      "true",
    )

    // When the server acknowledges the consent and later rolls it back
    rerender(
      <MyChangeScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: model(true) }}
      />,
    )
    rerender(
      <MyChangeScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: model(false) }}
      />,
    )

    // Then the retired optimistic consent cannot reappear
    expect(screen.getByRole("switch", { name: "수면 시간" })).toHaveAttribute(
      "aria-checked",
      "false",
    )
  })

  it("synchronizes consent and audit props and shows corrected guidance", () => {
    // Given
    const handlers = { onConsentChange: vi.fn() } satisfies MyChangeHandlers
    const { rerender } = render(
      <MyChangeScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{
          status: "ready",
          data: model(false, [{ id: "audit-before", label: "이전 기록" }]),
        }}
      />,
    )

    // When
    rerender(
      <MyChangeScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{
          status: "ready",
          data: model(true, [{ id: "audit-after", label: "새 서버 기록" }]),
        }}
      />,
    )

    // Then
    expect(screen.getByRole("switch", { name: "수면 시간" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    const history = screen.getByRole("region", { name: "공유 변경 기록" })
    expect(within(history).getByText("새 서버 기록")).toBeInTheDocument()
    expect(within(history).queryByText("이전 기록")).not.toBeInTheDocument()
    expect(
      screen.getByText("항목별로 필요할 때만 켜세요. 언제든 다시 끌 수 있어요."),
    ).toBeInTheDocument()
  })

  it("recovers after a rejected consent change", async () => {
    // Given
    const user = userEvent.setup()
    let attempt = 0
    const onConsentChange = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("consent failed")
      return {
        kind: "success",
        auditEntry: { id: "audit-enabled", label: "수면 시간 공유 허용" },
      } as const
    })
    render(
      <MyChangeScreen
        handlers={{ onConsentChange }}
        onRetry={vi.fn()}
        state={{ status: "ready", data: model(false) }}
      />,
    )

    // When
    await user.click(screen.getByRole("switch", { name: "수면 시간" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("공유 설정을 바꾸지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("switch", { name: "수면 시간" })).toBeEnabled()
    expect(screen.getByRole("switch", { name: "수면 시간" })).toHaveAttribute(
      "aria-checked",
      "false",
    )

    // When
    await user.click(screen.getByRole("switch", { name: "수면 시간" }))

    // Then
    expect(onConsentChange).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("switch", { name: "수면 시간" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(screen.getByText("수면 시간 공유 허용")).toBeInTheDocument()
  })
})
