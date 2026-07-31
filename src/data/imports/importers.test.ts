import { describe, expect, it } from "vitest"
import { ImportArtifactSchema, type ImportFormat } from "../../domain"
import { parseImportArtifact } from "./index"

function artifact(format: ImportFormat) {
  return ImportArtifactSchema.parse({
    id: `import-artifact-${format}`,
    participantId: "membership-participant-01",
    format,
    originalFilename: `sample.${format}`,
    checksum: "12345678abcdef",
    byteSize: 500,
    importedAt: "2026-08-29T09:00:00+09:00",
  })
}

describe("representative import adapters", () => {
  it("accepts a FIT artifact boundary but explicitly rejects undecoded binary content", () => {
    const fitArtifact = artifact("fit")

    const result = parseImportArtifact(fitArtifact, "binary-fit-placeholder")

    expect(fitArtifact.format).toBe("fit")
    expect(result.kind).toBe("rejected")
    if (result.kind === "rejected") {
      expect(result.issues[0]?.code).toBe("unsupported_binary")
      expect(result.warnings).toContain("fit_binary_requires_audited_decoder")
    }
  })

  it("turns representative CSV rows into provenance-bearing review drafts", () => {
    const content = [
      "timestamp,metric,value,unit",
      "2026-08-29T07:00:00+09:00,distance,5000,m",
      "2026-08-29T07:00:00+09:00,duration,1800,s",
    ].join("\n")

    const result = parseImportArtifact(artifact("csv"), content)

    expect(result.kind).toBe("parsed")
    if (result.kind === "parsed") {
      expect(result.drafts).toHaveLength(2)
      expect(result.drafts[0]).toMatchObject({
        metric: "distance",
        status: "pending_review",
        provenance: { adapter: "csv", sourceRecord: "row-2" },
      })
      expect(result.warnings).toContain("representative_adapter_not_vendor_complete")
    }
  })

  it("rejects CSV missing fields, malformed numbers, and invalid units", () => {
    const samples = [
      "timestamp,metric,value\n2026-08-29T07:00:00Z,distance,5000",
      "timestamp,metric,value,unit\n2026-08-29T07:00:00Z,distance,fast,m",
      "timestamp,metric,value,unit\n2026-08-29T07:00:00Z,distance,5,km",
    ]

    const results = samples.map((content) => parseImportArtifact(artifact("csv"), content))

    expect(results.every((result) => result.kind === "rejected")).toBe(true)
  })

  it("derives an estimated distance draft from representative GPX trackpoints", () => {
    const content = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="37.5000" lon="127.0000"><time>2026-08-29T07:00:00Z</time></trkpt>
      <trkpt lat="37.5010" lon="127.0000"><time>2026-08-29T07:01:00Z</time></trkpt>
    </trkseg></trk></gpx>`

    const result = parseImportArtifact(artifact("gpx"), content)

    expect(result.kind).toBe("parsed")
    if (result.kind === "parsed") {
      expect(result.drafts[0]).toMatchObject({ metric: "distance", unit: "m" })
      expect(result.drafts[0]?.value).toBeGreaterThan(100)
      expect(result.warnings).toContain("distance_estimated_from_trackpoints")
    }
  })

  it("rejects GPX with missing time or malformed coordinates", () => {
    const missing = `<gpx><trk><trkseg><trkpt lat="bad" lon="127" /></trkseg></trk></gpx>`

    expect(parseImportArtifact(artifact("gpx"), missing).kind).toBe("rejected")
  })

  it("reads representative TCX distance and duration as separate drafts", () => {
    const content = `<TrainingCenterDatabase><Activities><Activity>
      <Id>2026-08-29T07:00:00Z</Id><Lap>
      <TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters>
      </Lap></Activity></Activities></TrainingCenterDatabase>`

    const result = parseImportArtifact(artifact("tcx"), content)

    expect(result.kind).toBe("parsed")
    if (result.kind === "parsed") {
      expect(result.drafts.map((draft) => draft.metric)).toEqual(["distance", "duration"])
    }
  })

  it("reads one representative Apple Health heart-rate record", () => {
    const content = `<HealthData><Record type="HKQuantityTypeIdentifierHeartRate"
      unit="count/min" value="58" startDate="2026-08-29T07:00:00+09:00" /></HealthData>`

    const result = parseImportArtifact(artifact("apple-xml"), content)

    expect(result.kind).toBe("parsed")
    if (result.kind === "parsed") {
      expect(result.drafts[0]).toMatchObject({ metric: "heart_rate", unit: "bpm", value: 58 })
    }
  })

  it("reads representative Samsung steps and rejects malformed JSON numbers", () => {
    const good = JSON.stringify({
      records: [
        {
          type: "step_count",
          value: 8_432,
          unit: "count",
          startTime: "2026-08-29T07:00:00+09:00",
        },
      ],
    })
    const bad = JSON.stringify({
      records: [
        {
          type: "step_count",
          value: "many",
          unit: "count",
          startTime: "2026-08-29T07:00:00+09:00",
        },
      ],
    })

    const goodResult = parseImportArtifact(artifact("samsung-json"), good)

    expect(goodResult.kind).toBe("parsed")
    if (goodResult.kind === "parsed") {
      expect(goodResult.drafts[0]).toMatchObject({ metric: "steps", value: 8_432 })
    }
    expect(parseImportArtifact(artifact("samsung-json"), bad).kind).toBe("rejected")
    expect(parseImportArtifact(artifact("samsung-json"), "{").kind).toBe("rejected")
  })
})
