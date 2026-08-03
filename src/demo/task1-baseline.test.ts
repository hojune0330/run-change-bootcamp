import { describe, expect, it } from "vitest"
import { completeAssignment } from "./participant-actions.ts"
import { createInitialDemoState } from "./seed.ts"
import { DemoEnvelopeSchema, type DemoParticipantId, type DemoState } from "./state.ts"
import { DEMO_STORAGE_KEY, type DemoStorage, DemoStorageAdapter } from "./storage.ts"

function createMemoryStorage(): {
  readonly values: Map<string, string>
  readonly storage: DemoStorage
} {
  const values = new Map<string, string>()
  return {
    values,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    },
  }
}

function firstAssignment(state: DemoState): DemoState["assignments"][number] {
  const assignment = state.assignments[0]
  if (assignment === undefined) throw new Error("baseline fixture has no assignment")
  return assignment
}

describe("Todo 1 preview storage baseline", () => {
  it("creates a versioned envelope when preview storage is empty", () => {
    // Given
    const memory = createMemoryStorage()
    const adapter = new DemoStorageAdapter(memory.storage)

    // When
    const state = adapter.load()

    // Then
    const serialized = memory.values.get(DEMO_STORAGE_KEY)
    if (serialized === undefined) throw new Error("preview storage did not persist a seed")
    const envelope = DemoEnvelopeSchema.parse(JSON.parse(serialized))
    expect(envelope.version).toBe(1)
    expect(envelope.state).toEqual(state)
    expect(state.session).toBeNull()
  })

  it("resets malformed preview storage through the same versioned envelope", () => {
    // Given
    const memory = createMemoryStorage()
    memory.values.set(DEMO_STORAGE_KEY, "{malformed")
    const adapter = new DemoStorageAdapter(memory.storage)

    // When
    const state = adapter.load()

    // Then
    const serialized = memory.values.get(DEMO_STORAGE_KEY)
    if (serialized === undefined) throw new Error("preview reset did not persist a seed")
    const envelope = DemoEnvelopeSchema.parse(JSON.parse(serialized))
    expect(envelope.state).toEqual(state)
    expect(envelope.version).toBe(1)
  })
})

describe("Todo 1 assignment completion baseline", () => {
  it("pins the current implicit completion-post behavior before Todo 9 replaces it", () => {
    // Given
    const before = createInitialDemoState()
    const assignment = firstAssignment(before)
    const participantId: DemoParticipantId = "participant-01"

    // When
    const after = completeAssignment(before, {
      assignmentId: assignment.id,
      participantId,
    })

    // Then
    const completionPost = after.posts.find(
      (post) => post.id === `post-completion-${assignment.id}-${participantId}`,
    )
    expect(after.completions).toContainEqual({ assignmentId: assignment.id, participantId })
    expect(completionPost?.authorId).toBe(participantId)
    expect(after.posts).toHaveLength(before.posts.length + 1)
  })

  it("does not duplicate the baseline completion post on a repeated completion", () => {
    // Given
    const before = createInitialDemoState()
    const assignment = firstAssignment(before)
    const participantId: DemoParticipantId = "participant-01"
    const once = completeAssignment(before, { assignmentId: assignment.id, participantId })

    // When
    const twice = completeAssignment(once, { assignmentId: assignment.id, participantId })

    // Then
    expect(twice).toBe(once)
    expect(twice.completions).toHaveLength(1)
    expect(twice.posts).toHaveLength(once.posts.length)
  })
})
