import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const EXPECTED_SHA256 = "6af2205a161815774f4fd8dd39794cbd620968ca8b02762e3195ef903de9a85d"

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index]
  if (value === undefined) throw new Error(`JPEG ended at byte ${index}`)
  return value
}

function jpegDimensions(bytes: Uint8Array): { readonly width: number; readonly height: number } {
  if (byteAt(bytes, 0) !== 0xff || byteAt(bytes, 1) !== 0xd8) {
    throw new Error("logo is not a JPEG")
  }
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (byteAt(bytes, offset) !== 0xff) {
      offset += 1
      continue
    }
    while (byteAt(bytes, offset) === 0xff) offset += 1
    const marker = byteAt(bytes, offset)
    offset += 1
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue
    const length = (byteAt(bytes, offset) << 8) | byteAt(bytes, offset + 1)
    if (length < 2) throw new Error("invalid JPEG segment length")
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    if (isStartOfFrame) {
      return {
        height: (byteAt(bytes, offset + 3) << 8) | byteAt(bytes, offset + 4),
        width: (byteAt(bytes, offset + 5) << 8) | byteAt(bytes, offset + 6),
      }
    }
    offset += length
  }
  throw new Error("JPEG dimensions were not found")
}

describe("PLUS source asset provenance", () => {
  it("preserves the supplied JPEG bytes, RGB dimensions, and checksum", () => {
    // Given
    const assetPath = resolve(import.meta.dirname, "../../public/brand/plus-logo.jpg")

    // When
    const bytes = readFileSync(assetPath)
    const hash = createHash("sha256").update(bytes).digest("hex")
    const dimensions = jpegDimensions(bytes)

    // Then
    expect(hash).toBe(EXPECTED_SHA256)
    expect(dimensions).toEqual({ width: 1280, height: 672 })
    expect(bytes.length).toBeGreaterThan(0)
  })
})
