import { type ImportParseResult, rejected } from "./result"

export const FIT_UNSUPPORTED_WARNING = "fit_binary_requires_audited_decoder" as const

export function parseFit(): ImportParseResult {
  return rejected(
    {
      code: "unsupported_binary",
      message: "FIT binary decoding requires an audited decoder before metrics can become drafts",
    },
    [FIT_UNSUPPORTED_WARNING],
  )
}
