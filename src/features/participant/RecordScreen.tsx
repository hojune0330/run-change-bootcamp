import { FileArrowUpIcon } from "@phosphor-icons/react/FileArrowUp"
import { ImageIcon } from "@phosphor-icons/react/Image"
import { PencilSimpleIcon } from "@phosphor-icons/react/PencilSimple"
import { useState } from "react"
import { Card } from "../../components/primitives/index.ts"
import { FileImportForm } from "./FileImportForm.tsx"
import { LoadableBoundary } from "./LoadableBoundary.tsx"
import { ManualMetricForm } from "./ManualMetricForm.tsx"
import type { Loadable, RecordHandlers, RecordViewModel } from "./models.ts"
import "./participant.css"
import { ScreenshotDraftForm } from "./ScreenshotDraftForm.tsx"

export type RecordScreenProps = {
  readonly state: Loadable<RecordViewModel>
  readonly handlers: RecordHandlers
  readonly onRetry: () => void
}

const RECORD_MODES = ["manual", "file", "screenshot"] as const
type RecordMode = (typeof RECORD_MODES)[number]

export function RecordScreen({ state, handlers, onRetry }: RecordScreenProps) {
  const [mode, setMode] = useState<RecordMode>("manual")

  return (
    <section aria-labelledby="participant-record-title" className="participant-screen">
      <header className="participant-screen__header">
        <p className="participant-screen__eyebrow">기본 비공개</p>
        <h1 id="participant-record-title">기록</h1>
        <p>직접 입력하거나 파일과 스크린샷을 검토할 초안으로 만들어요.</p>
      </header>
      <LoadableBoundary onRetry={onRetry} state={state}>
        {(model) => (
          <div className="participant-screen__content">
            <fieldset className="participant-mode-picker">
              <legend className="participant-visually-hidden">기록 방법</legend>
              <button
                aria-pressed={mode === "manual"}
                onClick={() => setMode("manual")}
                type="button"
              >
                <PencilSimpleIcon aria-hidden size={20} weight="bold" />
                <span>직접 입력</span>
              </button>
              <button aria-pressed={mode === "file"} onClick={() => setMode("file")} type="button">
                <FileArrowUpIcon aria-hidden size={20} weight="bold" />
                <span>파일 가져오기</span>
              </button>
              <button
                aria-pressed={mode === "screenshot"}
                onClick={() => setMode("screenshot")}
                type="button"
              >
                <ImageIcon aria-hidden size={20} weight="bold" />
                <span>스크린샷 올리기</span>
              </button>
            </fieldset>

            {mode === "manual" ? (
              <Card eyebrow="직접 입력" title="숫자를 직접 기록해요">
                <ManualMetricForm handlers={handlers} recordedOn={model.recordedOn} />
              </Card>
            ) : null}
            {mode === "file" ? (
              <Card eyebrow="파일 가져오기" title="활동 파일을 가져와요">
                <FileImportForm
                  handlers={handlers}
                  supportedExtensions={model.supportedExtensions}
                />
              </Card>
            ) : null}
            {mode === "screenshot" ? (
              <Card eyebrow="스크린샷" title="운동 화면을 올려요">
                <ScreenshotDraftForm handlers={handlers} />
              </Card>
            ) : null}
          </div>
        )}
      </LoadableBoundary>
    </section>
  )
}
