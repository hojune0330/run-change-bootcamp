import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { RecordHandlers, RecordViewModel } from "./models.ts"
import { RecordScreen } from "./RecordScreen.tsx"

const RECORD_MODEL = {
  recordedOn: "2026-08-31",
  supportedExtensions: ["fit", "tcx", "gpx", "csv", "xml", "json"],
} satisfies RecordViewModel

const createHandlers = (): RecordHandlers => ({
  onSaveManual: vi.fn(async () => ({ kind: "success" }) as const),
  onImportFile: vi.fn(async () => ({ kind: "error", message: "가져오지 못했어요." }) as const),
  onUploadScreenshot: vi.fn(
    async () => ({ kind: "error", message: "이미지를 읽지 못했어요." }) as const,
  ),
  onSaveDraft: vi.fn(async () => ({ kind: "success" }) as const),
})

describe("RecordScreen", () => {
  it("submits a parsed manual metric", async () => {
    // Given
    const user = userEvent.setup({ applyAccept: false })
    const handlers = createHandlers()
    render(
      <RecordScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: RECORD_MODEL }}
      />,
    )

    expect(screen.getByText("8월 31일")).toBeInTheDocument()

    // When
    await user.selectOptions(screen.getByLabelText("측정 항목"), "distance_km")
    await user.type(screen.getByLabelText("측정값"), "5.2")
    await user.click(screen.getByRole("button", { name: "직접 기록 저장" }))

    // Then
    expect(handlers.onSaveManual).toHaveBeenCalledWith({
      metricKey: "distance_km",
      value: 5.2,
      recordedOn: "2026-08-31",
    })
  })

  it("rejects an unsupported activity file before import", async () => {
    // Given
    const user = userEvent.setup({ applyAccept: false })
    const handlers = createHandlers()
    render(
      <RecordScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: RECORD_MODEL }}
      />,
    )
    await user.click(screen.getByRole("button", { name: "파일 가져오기" }))

    // When
    await user.upload(
      screen.getByLabelText("활동 파일"),
      new File(["notes"], "memo.txt", { type: "text/plain" }),
    )

    // Then
    expect(screen.getByRole("alert")).toHaveTextContent("지원하지 않는 파일이에요.")
    expect(handlers.onImportFile).not.toHaveBeenCalled()
  })

  it("renders an imported file as a reviewable draft", async () => {
    // Given
    const user = userEvent.setup()
    const handlers = {
      ...createHandlers(),
      onImportFile: vi.fn(
        async () =>
          ({
            kind: "success",
            draft: {
              id: "draft-file-run",
              source: "file",
              sourceLabel: "morning-run.gpx",
              metrics: [{ label: "거리", value: "5.2 km" }],
              notes: ["시간은 꼭 확인해 주세요."],
            },
          }) as const,
      ),
    } satisfies RecordHandlers
    render(
      <RecordScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: RECORD_MODEL }}
      />,
    )
    await user.click(screen.getByRole("button", { name: "파일 가져오기" }))
    await user.upload(
      screen.getByLabelText("활동 파일"),
      new File(["track"], "morning-run.gpx", { type: "application/gpx+xml" }),
    )

    // When
    await user.click(screen.getByRole("button", { name: "초안 만들기" }))

    // Then
    expect(screen.getByRole("heading", { name: "검토할 기록 초안" })).toBeInTheDocument()
    expect(screen.getByText("5.2 km")).toBeInTheDocument()
    expect(screen.getByText("기록에 아직 반영되지 않았어요.")).toBeInTheDocument()
  })

  it("keeps a screenshot draft reviewable when its preview is missing", async () => {
    // Given
    const user = userEvent.setup()
    const handlers = {
      ...createHandlers(),
      onUploadScreenshot: vi.fn(
        async () =>
          ({
            kind: "success",
            draft: {
              id: "draft-screenshot-run",
              source: "screenshot",
              sourceLabel: "watch.png",
              metrics: [{ label: "시간", value: "31:20" }],
              notes: [],
            },
          }) as const,
      ),
    } satisfies RecordHandlers
    render(
      <RecordScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: RECORD_MODEL }}
      />,
    )
    await user.click(screen.getByRole("button", { name: "스크린샷 올리기" }))
    await user.upload(
      screen.getByLabelText("운동 스크린샷"),
      new File(["image"], "watch.png", { type: "image/png" }),
    )

    // When
    await user.click(screen.getByRole("button", { name: "이미지에서 초안 만들기" }))

    // Then
    expect(screen.getByText("미리보기를 불러오지 못했어요.")).toBeInTheDocument()
    expect(screen.getByText("31:20")).toBeInTheDocument()
  })
})
