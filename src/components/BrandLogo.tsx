import { type BrandConfig, brandAssetPath, DEFAULT_BRAND } from "../design/brand-config.ts"

type BrandLogoProps = {
  readonly brand?: BrandConfig
  readonly className?: string
}

export function BrandLogo({ brand = DEFAULT_BRAND, className }: BrandLogoProps) {
  const logoSrc = brandAssetPath(brand.logo.src, import.meta.env.BASE_URL)
  const classes = ["brand-logo", className].filter(Boolean).join(" ")

  return (
    <span className={classes} data-brand-logo>
      <img
        alt={brand.logo.alt}
        decoding="async"
        height={brand.logo.height}
        src={logoSrc}
        width={brand.logo.width}
      />
    </span>
  )
}
