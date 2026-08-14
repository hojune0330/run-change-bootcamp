import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ACTIVITY_INSIGHT_TEMPLATES } from "../../domain/activity-insight.ts"
import type {
  PilotParticipantActivityInsight as ActivityInsight,
  PilotGateway,
  PilotOperationResult,
} from "../../integrations/supabase/pilot-gateway.ts"
import { PilotParticipantActivityInsight } from "./PilotParticipantActivityInsight.tsx"

const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"

type ActivityInsightGateway = Pick<PilotGateway, "listParticipantActivityInsights">

const OWN_INSIGHT = {
  activityDays: 3,
  averageHeartRateBpm: 146,
  contentCategory: "activity_summary",
  contentVariant: "multiple_days",
  deleteAfter: "2026-11-23T00:00:00.000Z",
  distanceM: 12_400,
  durationS: 4_680,
  id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
  isPartialWeek: true,
  paceSecondsPerKm: 377,
  participantProfileId: PARTICIPANT_ID,
  programId: PROGRAM_ID,
  sourceCount: 3,
  steps: 18_200,
  templateVersion: "activity-insight-v1",
  weekEnd: "2026-08-31",
  weekStart: "2026-08-24",
} satisfies ActivityInsight

const FOREIGN_INSIGHT = {
  ...OWN_INSIGHT,
  activityDays: 1,
  averageHeartRateBpm: 182,
  distanceM: 999_000,
  id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  participantProfileId: "22222222-2222-4222-8222-222222222222",
  sourceCount: 99,
} satisfies ActivityInsight

function gatewayFor(
  result: PilotOperationResult<readonly ActivityInsight[]>,
): ActivityInsightGateway {
  return {
    listParticipantActivityInsights: vi.fn(async () => result),
  }
}

function renderInsight(gateway: ActivityInsightGateway) {
  return render(
    <PilotParticipantActivityInsight
      gateway={gateway}
      participantProfileId={PARTICIPANT_ID}
      programId={PROGRAM_ID}
    />,
  )
}

describe("PilotParticipantActivityInsight", () => {
  it("renders only the participant's reviewed-import insight with safe template content", async () => {
    const gateway = gatewayFor({ ok: true, value: [FOREIGN_INSIGHT, OWN_INSIGHT] })

    renderInsight(gateway)

    const insight = await screen.findByRole("region", { name: "검토된 주간 활동 요약" })
    expect(gateway.listParticipantActivityInsights).toHaveBeenCalledWith(PROGRAM_ID)
    expect(insight).toHaveTextContent(ACTIVITY_INSIGHT_TEMPLATES.multiple_days.summary)
    expect(insight).toHaveTextContent(ACTIVITY_INSIGHT_TEMPLATES.multiple_days.nextStep)
    expect(insight).toHaveTextContent("검토된 가져오기 3건")
    expect(insight).toHaveTextContent("서울 시간 (Asia/Seoul)")
    expect(insight).toHaveTextContent("12.4 km")
    expect(insight).not.toHaveTextContent("999 km")
    expect(insight).not.toHaveTextContent(/Garmin|심박수|걸음 수|provider|source row/i)
  })

  it("renders a clear no-data state", async () => {
    renderInsight(gatewayFor({ ok: true, value: [] }))

    expect(await screen.findByRole("heading", { name: "아직 표시할 요약이 없어요" })).toBeVisible()
  })

  it("clears a previously rendered insight when access is withdrawn", async () => {
    const readyGateway = gatewayFor({ ok: true, value: [OWN_INSIGHT] })
    const revokedGateway = gatewayFor({
      error: { kind: "withdrawn", retryable: false },
      ok: false,
    })
    const view = renderInsight(readyGateway)
    expect(await screen.findByText(ACTIVITY_INSIGHT_TEMPLATES.multiple_days.summary)).toBeVisible()

    view.rerender(
      <PilotParticipantActivityInsight
        gateway={revokedGateway}
        participantProfileId={PARTICIPANT_ID}
        programId={PROGRAM_ID}
      />,
    )

    expect(await screen.findByRole("heading", { name: "활동 요약이 제거되었어요" })).toBeVisible()
    expect(screen.queryByText(ACTIVITY_INSIGHT_TEMPLATES.multiple_days.summary)).toBeNull()
  })
})
