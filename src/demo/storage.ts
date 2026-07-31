import { createInitialDemoState } from "./seed.ts"
import { type DemoEnvelope, DemoEnvelopeSchema, type DemoState } from "./state.ts"

export const DEMO_STORAGE_KEY = "run-change-bootcamp:demo:v1"

export interface DemoStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

function envelopeFor(state: DemoState): DemoEnvelope {
  return DemoEnvelopeSchema.parse({ version: 1, state })
}

export class DemoStorageAdapter {
  constructor(private readonly storage: DemoStorage) {}

  load(): DemoState {
    const stored = this.storage.getItem(DEMO_STORAGE_KEY)
    if (stored === null) return this.reset()

    let input: unknown
    try {
      input = JSON.parse(stored)
    } catch (error: unknown) {
      if (!(error instanceof SyntaxError)) throw error
      return this.reset()
    }
    const parsed = DemoEnvelopeSchema.safeParse(input)
    return parsed.success ? parsed.data.state : this.reset()
  }

  save(state: DemoState): void {
    this.storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(envelopeFor(state)))
  }

  reset(): DemoState {
    this.storage.removeItem(DEMO_STORAGE_KEY)
    const state = createInitialDemoState()
    this.save(state)
    return state
  }
}
