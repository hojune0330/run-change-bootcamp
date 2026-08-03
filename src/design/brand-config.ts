import { z } from "zod"
import { COLOR_TOKENS } from "./color-tokens.ts"

export const BRAND_TENANT_IDS = ["hanwha-life-plus-run", "fixture-partner-plus-run"] as const
export type BrandTenantId = (typeof BRAND_TENANT_IDS)[number]

const LOGO_SOURCE = {
  alt: "PLUS 로고",
  height: 672,
  sha256: "6af2205a161815774f4fd8dd39794cbd620968ca8b02762e3195ef903de9a85d",
  src: "/brand/plus-logo.jpg",
  width: 1280,
} as const

export const PRODUCT_METADATA = {
  backgroundColor: COLOR_TOKENS.canvas,
  description: "PLUS Run에서 오늘의 달리기와 변화를 기록하세요.",
  iconAny: "/icon-any.svg",
  iconMaskable: "/icon-maskable.svg",
  name: "PLUS Run",
  shortName: "PLUS Run",
  themeColor: COLOR_TOKENS.accent,
} as const

export type BrandLabels = {
  readonly auth: string
  readonly report: string
  readonly share: string
  readonly shell: string
}

export type BrandConfig = {
  readonly labels: BrandLabels
  readonly logo: typeof LOGO_SOURCE
  readonly productName: typeof PRODUCT_METADATA.name
  readonly tenantId: BrandTenantId
  readonly tenantName: string
}

function labelsFor(tenantName: string): BrandLabels {
  return {
    auth: `${tenantName} 로그인`,
    report: `${tenantName} 리포트`,
    share: `${tenantName} 기록 공유`,
    shell: `${tenantName} 콘텐츠`,
  }
}

export const DEFAULT_BRAND = {
  labels: labelsFor("한화생명 PLUS Run"),
  logo: LOGO_SOURCE,
  productName: PRODUCT_METADATA.name,
  tenantId: "hanwha-life-plus-run",
  tenantName: "한화생명 PLUS Run",
} as const satisfies BrandConfig

export const SECOND_TENANT_BRAND = {
  labels: labelsFor("세컨드 파트너 프로그램 PLUS Run"),
  logo: LOGO_SOURCE,
  productName: PRODUCT_METADATA.name,
  tenantId: "fixture-partner-plus-run",
  tenantName: "세컨드 파트너 프로그램 PLUS Run",
} as const satisfies BrandConfig

const BRANDS = [DEFAULT_BRAND, SECOND_TENANT_BRAND] as const satisfies readonly BrandConfig[]
const EnvironmentSchema = z.object({ VITE_PLUS_TENANT: z.string().optional() }).passthrough()

export function resolveBrandConfig(environment: unknown): BrandConfig {
  const parsed = EnvironmentSchema.safeParse(environment)
  if (!parsed.success) return DEFAULT_BRAND

  const tenantId = parsed.data.VITE_PLUS_TENANT
  const brand = BRANDS.find((candidate) => candidate.tenantId === tenantId)
  return brand ?? DEFAULT_BRAND
}

export function brandAssetPath(assetPath: string, basePath: string): string {
  const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
  if (normalizedBase === "") return assetPath
  if (assetPath.startsWith(`${normalizedBase}/`)) return assetPath
  return `${normalizedBase}${assetPath.startsWith("/") ? assetPath : `/${assetPath}`}`
}
