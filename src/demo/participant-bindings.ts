import type {
  FeedHandlers,
  MyChangeHandlers,
  RecordHandlers,
  ShareAttempt,
  ShareServices,
  TodayHandlers,
} from "../features/participant/index.ts"
import type { DemoRepository } from "./repository.ts"
import type { DemoParticipantId } from "./state.ts"

async function shareAttempt(operation: () => Promise<void>): Promise<ShareAttempt> {
  try {
    await operation()
    return { kind: "success" }
  } catch (error: unknown) {
    if (error instanceof Error || error instanceof DOMException) return { kind: "denied" }
    throw error
  }
}

export function createShareServices(browser: Navigator): ShareServices {
  const nativeShare = browser.share
  const clipboard = browser.clipboard
  return {
    ...(typeof nativeShare === "function"
      ? {
          nativeShare: (payload) => shareAttempt(() => nativeShare.call(browser, { ...payload })),
        }
      : {}),
    writeClipboard: (text) =>
      clipboard === undefined
        ? Promise.resolve({ kind: "denied" })
        : shareAttempt(() => clipboard.writeText(text)),
  }
}

export type ParticipantBindings = {
  readonly today: TodayHandlers
  readonly feed: FeedHandlers
  readonly record: RecordHandlers
  readonly change: MyChangeHandlers
  readonly share: ShareServices
}

export function participantBindings(
  repository: DemoRepository,
  participantId: DemoParticipantId,
): ParticipantBindings {
  return {
    today: {
      onCompleteAssignment: async (id) => repository.complete(participantId, id),
    },
    feed: {
      onHeart: async (id, hearted) => repository.heart(participantId, id, hearted),
      onComment: async (id, body) => repository.comment(participantId, id, body),
    },
    record: {
      onSaveManual: async (input) => repository.saveManual(participantId, input),
      onImportFile: (file) => repository.importFile(participantId, file),
      onUploadScreenshot: (file) => repository.uploadScreenshot(participantId, file),
      onSaveDraft: async (id) => repository.confirmDraft(participantId, id),
    },
    change: {
      onConsentChange: async (request) => repository.consent(participantId, request.enabled),
    },
    share: createShareServices(window.navigator),
  }
}
