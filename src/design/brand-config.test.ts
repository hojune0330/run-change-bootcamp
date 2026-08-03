import { describe, expect, it } from "vitest"
import {
  DEFAULT_BRAND,
  PRODUCT_METADATA,
  resolveBrandConfig,
  SECOND_TENANT_BRAND,
} from "./brand-config.ts"

describe("PLUS Run brand configuration", () => {
  it("falls back to the Hanwha Life tenant when runtime config is missing", () => {
    // Given
    const environment = {}

    // When
    const brand = resolveBrandConfig(environment)

    // Then
    expect(brand).toEqual(DEFAULT_BRAND)
    expect(brand.productName).toBe("PLUS Run")
    expect(brand.tenantName).toBe("한화생명 PLUS Run")
  })

  it("resolves only the allowlisted second tenant and keeps the same source asset", () => {
    // Given
    const environment = { VITE_PLUS_TENANT: SECOND_TENANT_BRAND.tenantId }

    // When
    const brand = resolveBrandConfig(environment)

    // Then
    expect(brand).toEqual(SECOND_TENANT_BRAND)
    expect(brand.logo.src).toBe(DEFAULT_BRAND.logo.src)
    expect(brand.logo.sha256).toBe(DEFAULT_BRAND.logo.sha256)
  })

  it("uses stable product metadata regardless of tenant selection", () => {
    // Given
    const brand = resolveBrandConfig({ VITE_PLUS_TENANT: SECOND_TENANT_BRAND.tenantId })

    // When
    const metadata = PRODUCT_METADATA

    // Then
    expect(metadata.name).toBe("PLUS Run")
    expect(metadata.shortName).toBe("PLUS Run")
    expect(metadata.description).toContain("PLUS Run")
    expect(brand.labels.share).toContain(brand.productName)
  })

  it("returns the safe default for an unallowlisted tenant", () => {
    // Given
    const environment = { VITE_PLUS_TENANT: "https://attacker.example/logo.svg" }

    // When
    const brand = resolveBrandConfig(environment)

    // Then
    expect(brand).toEqual(DEFAULT_BRAND)
  })
})
