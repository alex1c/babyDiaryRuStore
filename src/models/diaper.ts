/**
 * Diaper event types and inputs.
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'

/** Quick-entry diaper kinds (one tap). */
export type DiaperKind = 'wet' | 'dirty' | 'both' | 'dry'

export type DiaperColor =
	| 'yellow'
	| 'brown'
	| 'green'
	| 'black'
	| 'other'

export type DiaperConsistency =
	| 'liquid'
	| 'soft'
	| 'formed'
	| 'hard'
	| 'other'

export interface DiaperEvent {
	id: string
	childId: string
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	kind: DiaperKind
	wet: boolean
	dirty: boolean
	hasRash: boolean
	color: DiaperColor | null
	consistency: DiaperConsistency | null
}

export interface CreateDiaperInput {
	childId: string
	kind: DiaperKind
	occurredAt?: OffsetDateTime
	notes?: string | null
	color?: DiaperColor | null
	consistency?: DiaperConsistency | null
	hasRash?: boolean
}

export interface UpdateDiaperInput {
	kind?: DiaperKind
	occurredAt?: OffsetDateTime
	notes?: string | null
	color?: DiaperColor | null
	consistency?: DiaperConsistency | null
	hasRash?: boolean
}

export function diaperFlagsFromKind (kind: DiaperKind): {
	wet: boolean
	dirty: boolean
} {
	switch (kind) {
		case 'wet':
			return { wet: true, dirty: false }
		case 'dirty':
			return { wet: false, dirty: true }
		case 'both':
			return { wet: true, dirty: true }
		case 'dry':
			return { wet: false, dirty: false }
	}
}

export function diaperKindFromFlags (wet: boolean, dirty: boolean): DiaperKind {
	if (wet && dirty) {
		return 'both'
	}
	if (wet) {
		return 'wet'
	}
	if (dirty) {
		return 'dirty'
	}
	return 'dry'
}
