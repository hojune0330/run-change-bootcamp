import { createFixedProgramClock, formatKoreanProgramRange } from "../app/program-clock.ts"
import { IsoDateSchema } from "../domain/values.ts"
import { DEMO_PROGRAM } from "../fixtures/index.ts"

export const DEMO_DATA_PROVENANCE_LABEL = "시연용 합성 데이터"
export const DEMO_PROGRAM_CLOCK = createFixedProgramClock(IsoDateSchema.parse("2026-08-31"))
export const DEMO_PROGRAM_DATE_RANGE_LABEL = formatKoreanProgramRange(
  DEMO_PROGRAM.startsOn,
  DEMO_PROGRAM.endsOn,
)
