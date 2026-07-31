import { z } from "zod"
import { type ImportArtifact, IsoDateTimeSchema } from "../../domain"
import { createDraft, type ImportParseResult, parsed, rejected } from "./result"
import { parseXml } from "./xml"

const coordinateText = z
  .string()
  .trim()
  .regex(/^-?(?:\d+\.?\d*|\.\d+)$/)
  .transform(Number)

const TrackPointSchema = z
  .object({
    latitude: coordinateText.refine((value) => value >= -90 && value <= 90),
    longitude: coordinateText.refine((value) => value >= -180 && value <= 180),
    time: IsoDateTimeSchema,
  })
  .strict()

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function segmentMeters(
  first: z.infer<typeof TrackPointSchema>,
  second: z.infer<typeof TrackPointSchema>,
) {
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function parseGpx(artifact: ImportArtifact, content: string): ImportParseResult {
  const document = parseXml(content)
  if (document === null) {
    return rejected({ code: "malformed_content", message: "GPX XML is malformed" })
  }
  const points = Array.from(document.querySelectorAll("trkpt")).map((element) =>
    TrackPointSchema.safeParse({
      latitude: element.getAttribute("lat"),
      longitude: element.getAttribute("lon"),
      time: element.querySelector("time")?.textContent,
    }),
  )
  if (points.length < 2 || points.some((point) => !point.success)) {
    return rejected({ code: "missing_fields", message: "GPX needs two valid timed trackpoints" })
  }
  const validPoints = points.flatMap((point) => (point.success ? [point.data] : []))
  let distanceMeters = 0
  for (let index = 1; index < validPoints.length; index += 1) {
    const first = validPoints[index - 1]
    const second = validPoints[index]
    if (first !== undefined && second !== undefined) {
      distanceMeters += segmentMeters(first, second)
    }
  }
  const observedAt = validPoints[0]?.time
  if (observedAt === undefined) {
    return rejected({ code: "missing_fields", message: "GPX first trackpoint has no time" })
  }
  const draft = createDraft({
    artifact,
    ordinal: 1,
    observedAt,
    sourceRecord: "track-segment-1",
    measurement: { metric: "distance", unit: "m", value: distanceMeters },
    warnings: ["distance_estimated_from_trackpoints"],
  })
  return draft === null
    ? rejected({ code: "invalid_record", message: "GPX distance could not become a draft" })
    : parsed([draft], ["distance_estimated_from_trackpoints"])
}
