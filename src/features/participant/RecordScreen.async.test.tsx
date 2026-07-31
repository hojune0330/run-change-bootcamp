import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { RecordHandlers, ReviewDraftViewModel } from "./models.ts"
import { RecordScreen } from "./RecordScreen.tsx"

const FILE_DRAFT = {
  id: "draft-file-recovery",
  source: "file",
  sourceLabel: "run.gpx",
  metrics: [{ label: "거리", value: "5 km" }],
  notes: [],
} satisfies ReviewDraftViewModel

const SCREENSHOT_DRAFT = {
  ...FILE_DRAFT,
  id: "draft-screenshot-recovery",
  source: "screenshot",
  sourceLabel: "watch.png",
} satisfies ReviewDraftViewModel

const renderRecord = (handlers: RecordHandlers) =>
  render(
    <RecordScreen
      handlers={handlers}
      onRetry={vi.fn()}
      state={{
        status: "ready",
        data: { recordedOn: "2026-08-31", supportedExtensions: ["gpx"] },
      }}
    />,
  )

const successHandlers = (): RecordHandlers => ({
  onSaveManual: vi.fn(async () => ({ kind: "success" }) as const),
  onImportFile: vi.fn(async () => ({ kind: "success", draft: FILE_DRAFT }) as const),
  onUploadScreenshot: vi.fn(async () => ({ kind: "success", draft: SCREENSHOT_DRAFT }) as const),
  onSaveDraft: vi.fn(async () => ({ kind: "success" }) as const),
})

describe("RecordScreen async recovery", () => {
  it("recovers after a rejected manual save", async () => {
    // Given
    const user = userEvent.setup()
    let attempt = 0
    const onSaveManual = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("manual failed")
      return { kind: "success" } as const
    })
    const handlers = { ...successHandlers(), onSaveManual }
    renderRecord(handlers)
    await user.type(screen.getByLabelText("측정값"), "5")

    // When
    await user.click(screen.getByRole("button", { name: "직접 기록 저장" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("기록을 저장하지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("button", { name: "직접 기록 저장" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "직접 기록 저장" }))

    // Then
    expect(onSaveManual).toHaveBeenCalledTimes(2)
    expect(screen.getByText("직접 입력한 기록을 저장했어요.")).toBeInTheDocument()
  })

  it("recovers after a rejected file import", async () => {
    // Given
    const user = userEvent.setup({ applyAccept: false })
    let attempt = 0
    const onImportFile = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("import failed")
      return { kind: "success", draft: FILE_DRAFT } as const
    })
    renderRecord({ ...successHandlers(), onImportFile })
    await user.click(screen.getByRole("button", { name: "파일 가져오기" }))
    await user.upload(
      screen.getByLabelText("활동 파일"),
      new File(["track"], "run.gpx", { type: "application/gpx+xml" }),
    )

    // When
    await user.click(screen.getByRole("button", { name: "초안 만들기" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("파일을 가져오지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("button", { name: "초안 만들기" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "초안 만들기" }))

    // Then
    expect(onImportFile).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("heading", { name: "검토할 기록 초안" })).toBeInTheDocument()
  })

  it("recovers after a rejected screenshot upload", async () => {
    // Given
    const user = userEvent.setup({ applyAccept: false })
    let attempt = 0
    const onUploadScreenshot = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("upload failed")
      return { kind: "success", draft: SCREENSHOT_DRAFT } as const
    })
    renderRecord({ ...successHandlers(), onUploadScreenshot })
    await user.click(screen.getByRole("button", { name: "스크린샷 올리기" }))
    await user.upload(
      screen.getByLabelText("운동 스크린샷"),
      new File(["image"], "watch.png", { type: "image/png" }),
    )

    // When
    await user.click(screen.getByRole("button", { name: "이미지에서 초안 만들기" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("이미지를 읽지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("button", { name: "이미지에서 초안 만들기" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "이미지에서 초안 만들기" }))

    // Then
    expect(onUploadScreenshot).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("heading", { name: "검토할 기록 초안" })).toBeInTheDocument()
  })

  it("activates draft save and recovers after its request rejects", async () => {
    // Given
    const user = userEvent.setup({ applyAccept: false })
    let attempt = 0
    const onSaveDraft = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("save draft failed")
      return { kind: "success" } as const
    })
    renderRecord({ ...successHandlers(), onSaveDraft })
    await user.click(screen.getByRole("button", { name: "파일 가져오기" }))
    await user.upload(
      screen.getByLabelText("활동 파일"),
      new File(["track"], "run.gpx", { type: "application/gpx+xml" }),
    )
    await user.click(screen.getByRole("button", { name: "초안 만들기" }))

    // When
    await user.click(screen.getByRole("button", { name: "검토 완료 · 초안 보관" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(onSaveDraft).toHaveBeenCalledWith("draft-file-recovery")
    expect(error).toHaveTextContent("초안을 보관하지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("button", { name: "검토 완료 · 초안 보관" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "검토 완료 · 초안 보관" }))

    // Then
    expect(onSaveDraft).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "초안 보관됨" })).toBeDisabled()
  })
})
