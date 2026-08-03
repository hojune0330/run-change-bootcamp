import { z } from "zod"

const AggregateCellSchema = z
  .object({
    rowKey: z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/),
    columnKey: z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/),
    participantCount: z.number().int().nonnegative(),
    numericValue: z.number().finite().nullable(),
  })
  .strict()
  .readonly()

const AggregateCellsSchema = z.array(AggregateCellSchema).readonly()

export type SuppressedAggregateCell = z.infer<typeof AggregateCellSchema> & {
  readonly suppressed: boolean
  readonly suppressionReason: "primary" | "complementary" | null
}

function vulnerableKeys(
  cells: readonly SuppressedAggregateCell[],
  axis: "rowKey" | "columnKey",
): ReadonlySet<string> {
  const grouped = new Map<string, readonly SuppressedAggregateCell[]>()
  for (const cell of cells) {
    grouped.set(cell[axis], [...(grouped.get(cell[axis]) ?? []), cell])
  }
  return new Set(
    [...grouped.entries()]
      .filter(([, group]) => {
        const suppressedCount = group.filter((cell) => cell.suppressed).length
        return suppressedCount === 1 && group.some((cell) => !cell.suppressed)
      })
      .map(([key]) => key),
  )
}

export function suppressAggregateCells(input: unknown): readonly SuppressedAggregateCell[] {
  let result: readonly SuppressedAggregateCell[] = AggregateCellsSchema.parse(input).map(
    (cell) => ({
      ...cell,
      numericValue: cell.participantCount < 5 ? null : cell.numericValue,
      suppressed: cell.participantCount < 5,
      suppressionReason: cell.participantCount < 5 ? "primary" : null,
    }),
  )
  while (true) {
    const rows = vulnerableKeys(result, "rowKey")
    const columns = vulnerableKeys(result, "columnKey")
    const candidate = result
      .filter((cell) => !cell.suppressed && (rows.has(cell.rowKey) || columns.has(cell.columnKey)))
      .toSorted((left, right) => {
        const countDifference = left.participantCount - right.participantCount
        if (countDifference !== 0) return countDifference
        const leftKey = `${left.rowKey}:${left.columnKey}`
        const rightKey = `${right.rowKey}:${right.columnKey}`
        if (leftKey < rightKey) return -1
        if (leftKey > rightKey) return 1
        return 0
      })
      .at(0)
    if (candidate === undefined) return result
    result = result.map((cell) =>
      cell.rowKey === candidate.rowKey && cell.columnKey === candidate.columnKey
        ? { ...cell, numericValue: null, suppressed: true, suppressionReason: "complementary" }
        : cell,
    )
  }
}
