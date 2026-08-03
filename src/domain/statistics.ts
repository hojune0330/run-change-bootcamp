export class EmptyStatisticsInputError extends Error {
  readonly name = "EmptyStatisticsInputError"
}

export function percentileCont(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    throw new EmptyStatisticsInputError("percentile_cont requires at least one value")
  }
  const sorted = values.toSorted((left, right) => left - right)
  const position = (sorted.length - 1) * percentile
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted.at(lowerIndex)
  const upper = sorted.at(upperIndex)
  if (lower === undefined || upper === undefined) {
    throw new EmptyStatisticsInputError("percentile_cont index is outside the sorted values")
  }
  return lower + (upper - lower) * (position - lowerIndex)
}

export function roundOneDecimal(value: number): number {
  const roundedMagnitude = Math.round((Math.abs(value) + Number.EPSILON) * 10) / 10
  return value < 0 ? -roundedMagnitude : roundedMagnitude
}
