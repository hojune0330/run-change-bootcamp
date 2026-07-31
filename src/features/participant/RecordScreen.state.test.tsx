import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { RecordHandlers, RecordViewModel } from "./models.ts"
import { RecordScreen } from "./RecordScreen.tsx"

const handlers: RecordHandlers = {
  onSaveManual: vi.fn(),
  onImportFile: vi.fn(),
  onUploadScreenshot: vi.fn(),
  onSaveDraft: vi.fn(),
}

const model = (recordedOn: string): RecordViewModel => ({
  recordedOn,
  supportedExtensions: ["gpx"],
})

describe("RecordScreen prop synchronization", () => {
  it("updates a pristine date default but preserves a participant edit", async () => {
    // Given
    const user = userEvent.setup()
    const { rerender } = render(
      <RecordScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: model("2026-08-31") }}
      />,
    )

    // When
    rerender(
      <RecordScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: model("2026-09-01") }}
      />,
    )

    // Then
    expect(screen.getByLabelText("측정일")).toHaveValue("2026-09-01")

    // When
    await user.clear(screen.getByLabelText("측정일"))
    await user.type(screen.getByLabelText("측정일"), "2026-09-02")
    rerender(
      <RecordScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: model("2026-09-03") }}
      />,
    )

    // Then
    expect(screen.getByLabelText("측정일")).toHaveValue("2026-09-02")
  })
})
