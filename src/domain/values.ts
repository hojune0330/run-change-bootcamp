import { z } from "zod"

export const IsoDateSchema = z.iso.date().brand<"IsoDate">()
export type IsoDate = z.infer<typeof IsoDateSchema>

export const IsoDateTimeSchema = z.iso.datetime({ offset: true }).brand<"IsoDateTime">()
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>

export const PositiveMetersSchema = z.number().finite().positive().brand<"Meters">()
export type Meters = z.infer<typeof PositiveMetersSchema>

export const PositiveSecondsSchema = z.number().finite().positive().brand<"Seconds">()
export type Seconds = z.infer<typeof PositiveSecondsSchema>

export const NonnegativeCountSchema = z.number().finite().nonnegative().brand<"Count">()
export type Count = z.infer<typeof NonnegativeCountSchema>

export const PercentageSchema = z.number().finite().min(0).max(100).brand<"Percentage">()
export type Percentage = z.infer<typeof PercentageSchema>

export const NonEmptyTextSchema = z.string().trim().min(1).max(4_000)
