import { describe, expect, it, vi } from "vitest"
import type {
  PilotOperationResult,
  PilotUploadReference,
} from "../../integrations/supabase/pilot-gateway.ts"
import { importActivityFile } from "./pilot-participant-import.ts"

const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"

function uploadOkay(): PilotOperationResult<PilotUploadReference> {
  return { ok: true, value: { draftCount: 2, uploadId: "abababab-abab-4bab-8bab-abababababab" } }
}

describe("pilot participant import", () => {
  it("rejects an unsupported extension before touching the gateway", async () => {
    // Given
    const gateway = {
      importActivityDraft: vi.fn(async () => uploadOkay()),
    }

    // When
    const outcome = await importActivityFile(
      gateway as never,
      PROGRAM_ID,
      new File(["x"], "run.txt"),
    )

    // Then
    expect(outcome).toEqual({ kind: "local_error", message: "지원하지 않는 파일이에요." })
    expect(gateway.importActivityDraft).not.toHaveBeenCalled()
  })

  it("rejects files larger than the storage bound", async () => {
    // Given
    const gateway = {
      importActivityDraft: vi.fn(async () => uploadOkay()),
    }
    const big = new File(["x".repeat(15_728_641)], "big.gpx")

    // When
    const outcome = await importActivityFile(gateway as never, PROGRAM_ID, big)

    // Then
    expect(outcome).toEqual({
      kind: "local_error",
      message: "파일이 너무 커요. 15MB 이하 파일을 선택해 주세요.",
    })
    expect(gateway.importActivityDraft).not.toHaveBeenCalled()
  })

  it("rejects unparsable content with a local error", async () => {
    // Given
    const gateway = {
      importActivityDraft: vi.fn(async () => uploadOkay()),
    }

    // When
    const outcome = await importActivityFile(
      gateway as never,
      PROGRAM_ID,
      new File(["not a csv header"], "run.csv"),
    )

    // Then
    expect(outcome).toEqual({ kind: "local_error", message: "파일 내용을 확인해 주세요." })
    expect(gateway.importActivityDraft).not.toHaveBeenCalled()
  })

  it("skips step drafts and notes them while importing supported metrics", async () => {
    // Given
    const gateway = {
      importActivityDraft: vi.fn(async () => uploadOkay()),
    }
    const csv =
      "timestamp,metric,value,unit\n2026-08-26T07:00:00+09:00,distance,5230,m\n2026-08-26T07:15:00+09:00,steps,4200,count\n"

    // When
    const outcome = await importActivityFile(
      gateway as never,
      PROGRAM_ID,
      new File([csv], "run.csv"),
    )

    // Then
    expect(outcome.kind).toBe("success")
    if (outcome.kind !== "success") return
    expect(outcome.uploadId).toBe("abababab-abab-4bab-8bab-abababababab")
    expect(outcome.draft.metrics).toEqual([{ label: "거리", value: "5.2 km" }])
    expect(outcome.draft.notes).toContain("걸음 수는 파일럿 가져오기 범위에 아직 없어요.")
    expect(gateway.importActivityDraft).toHaveBeenCalledWith({
      draftRecords: [
        {
          metricType: "distance_m",
          numericValue: 5230,
          observedAt: "2026-08-26T07:00:00+09:00",
          unit: "m",
        },
      ],
      fileName: "run.csv",
      fileSize: expect.any(Number),
      programId: PROGRAM_ID,
      uploadKind: "csv",
    })
  })

  it("surfaces a gateway rejection as a gateway error", async () => {
    // Given
    const gateway = {
      importActivityDraft: vi.fn(
        async (): Promise<PilotOperationResult<PilotUploadReference>> => ({
          ok: false,
          error: { kind: "invalid_response", retryable: false },
        }),
      ),
    }

    // When
    const outcome = await importActivityFile(
      gateway as never,
      PROGRAM_ID,
      new File(
        ["timestamp,metric,value,unit\n2026-08-26T07:00:00+09:00,distance,5230,m\n"],
        "run.csv",
      ),
    )

    // Then
    expect(outcome).toEqual({
      kind: "gateway_error",
      error: { kind: "invalid_response", retryable: false },
    })
  })
})
