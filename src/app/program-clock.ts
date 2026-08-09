import { type IsoDate, IsoDateSchema } from "../domain/values.ts"

export type ProgramClock = {
  readonly today: () => IsoDate
}

const SEOUL_TIME_ZONE = "Asia/Seoul"

function dateAtSeoulMidnight(date: IsoDate): Date {
  return new Date(`${date}T00:00:00+09:00`)
}

export function createFixedProgramClock(referenceDate: IsoDate): ProgramClock {
  return { today: () => referenceDate }
}

export function createSeoulProgramClock(now: () => Date = () => new Date()): ProgramClock {
  return {
    today: () => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone: SEOUL_TIME_ZONE,
        year: "numeric",
      }).formatToParts(now())
      const datePart = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value
      return IsoDateSchema.parse(`${datePart("year")}-${datePart("month")}-${datePart("day")}`)
    },
  }
}

export function formatKoreanDate(date: IsoDate, style: "month_day" | "full_with_weekday"): string {
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "long",
    timeZone: SEOUL_TIME_ZONE,
    ...(style === "full_with_weekday" ? { weekday: "long" as const } : {}),
  }).format(dateAtSeoulMidnight(date))
  return formatted.replaceAll(". ", "월 ").replace(".", "일")
}

export function formatKoreanDueDate(value: string): string {
  const date = IsoDateSchema.safeParse(value)
  return date.success ? `${formatKoreanDate(date.data, "month_day")}까지` : "기한 미정"
}

export function formatKoreanProgramRange(startsOn: string, endsOn: string): string {
  const start = IsoDateSchema.safeParse(startsOn)
  const end = IsoDateSchema.safeParse(endsOn)
  if (!start.success || !end.success) return "일정 미정"

  const [startYear] = start.data.split("-")
  return `${startYear}년 ${formatKoreanDate(start.data, "month_day")} – ${formatKoreanDate(end.data, "month_day")}`
}
