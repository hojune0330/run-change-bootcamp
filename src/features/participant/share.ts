export type SharePayload = {
  readonly title: string
  readonly text: string
  readonly url: string
}

export type ShareAttempt = { readonly kind: "success" } | { readonly kind: "denied" }

export type ShareServices = {
  readonly nativeShare?: (payload: SharePayload) => Promise<ShareAttempt>
  readonly writeClipboard: (text: string) => Promise<ShareAttempt>
}

export type ShareOutcome =
  | { readonly kind: "native" }
  | { readonly kind: "clipboard" }
  | { readonly kind: "unavailable" }

export async function shareParticipantPost(
  payload: SharePayload,
  services: ShareServices,
): Promise<ShareOutcome> {
  const nativeShare = services.nativeShare
  if (nativeShare !== undefined) {
    const nativeResult = await nativeShare(payload)
    switch (nativeResult.kind) {
      case "success":
        return { kind: "native" }
      case "denied":
        break
    }
  }

  const clipboardResult = await services.writeClipboard(`${payload.text}\n${payload.url}`)
  switch (clipboardResult.kind) {
    case "success":
      return { kind: "clipboard" }
    case "denied":
      return { kind: "unavailable" }
  }
}
