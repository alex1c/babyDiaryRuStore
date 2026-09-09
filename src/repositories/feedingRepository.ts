/**
 * Feeding repository — breastfeeding timer, bottle, pumping, water, solids.
 * Transactions use transactionDb directly (never re-enter the FIFO queue).
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import {
	addSideSegment,
	breastfeedingLiveTotals,
} from '../domain/breastfeedingDuration'
import {
	assertNonNegativeSeconds,
	assertPositiveMl,
	FeedingValidationError,
	MAX_BOTTLE_ML,
	MAX_PUMP_ML,
	MAX_WATER_ML,
} from '../domain/feedingLabels'
import type {
	BottleContent,
	BottleEvent,
	BreastfeedingEvent,
	BreastSide,
	CreateBottleInput,
	CreatePumpingInput,
	CreateSolidInput,
	CreateWaterInput,
	FeedingEvent,
	FeedingKind,
	ManualBreastfeedingInput,
	PumpingEvent,
	SolidFoodEvent,
	SolidReaction,
	StartBreastfeedingInput,
	WaterEvent,
} from '../models/feeding'
import { isFeedingEventType } from '../models/feeding'
import {
	buildEventEnd,
	buildEventStart,
	localDateFromOffsetDateTime,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

interface FeedingJoinRow {
	id: string
	child_id: string
	type: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	feeding_kind: string
	side: string | null
	amount_ml: number | null
	duration_seconds: number | null
	food_name: string | null
	left_duration_seconds: number | null
	right_duration_seconds: number | null
	initial_side: string | null
	last_side: string | null
	side_started_at: string | null
	bottle_content: string | null
	amount_text: string | null
	reaction: string | null
}

const FEEDING_SELECT = `
	SELECT e.id, e.child_id, e.type, e.start_at, e.end_at, e.start_local_date,
	       e.end_local_date, e.notes, e.created_at, e.updated_at,
	       f.feeding_kind, f.side, f.amount_ml, f.duration_seconds, f.food_name,
	       f.left_duration_seconds, f.right_duration_seconds, f.initial_side,
	       f.last_side, f.side_started_at, f.bottle_content, f.amount_text, f.reaction
	FROM events e
	INNER JOIN event_feeding f ON f.event_id = e.id
	WHERE e.type IN ('breastfeeding','bottle','pumping','water','solid_food')
`

function mapFeeding (row: FeedingJoinRow): FeedingEvent {
	if (!isFeedingEventType(row.type)) {
		throw new Error(`Unknown feeding event type: ${row.type}`)
	}
	const base = {
		id: row.id,
		childId: row.child_id,
		startAt: row.start_at,
		endAt: row.end_at,
		startLocalDate: row.start_local_date,
		endLocalDate: row.end_local_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		feedingKind: row.feeding_kind as FeedingKind,
	}

	switch (row.type) {
		case 'breastfeeding':
			return {
				...base,
				type: 'breastfeeding',
				feedingKind: 'breastfeeding',
				leftDurationSeconds: row.left_duration_seconds ?? 0,
				rightDurationSeconds: row.right_duration_seconds ?? 0,
				initialSide: (row.initial_side as BreastSide) ?? 'left',
				lastSide: (row.last_side as BreastSide) ?? 'left',
				sideStartedAt: row.side_started_at,
			}
		case 'bottle':
			return {
				...base,
				type: 'bottle',
				feedingKind:
					row.feeding_kind === 'formula' ? 'formula' : 'expressed_milk',
				amountMl: row.amount_ml ?? 0,
			}
		case 'pumping':
			return {
				...base,
				type: 'pumping',
				feedingKind: 'pumping',
				side: (row.side as BreastSide | 'both' | null) ?? null,
				durationSeconds: row.duration_seconds,
				amountMl: row.amount_ml,
			}
		case 'water':
			return {
				...base,
				type: 'water',
				feedingKind: 'water',
				amountMl: row.amount_ml ?? 0,
			}
		case 'solid_food':
			return {
				...base,
				type: 'solid_food',
				feedingKind: 'solid_food',
				foodName: row.food_name ?? '',
				amountText: row.amount_text,
				reaction: (row.reaction as SolidReaction | null) ?? null,
			}
	}
}

export class FeedingRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<FeedingEvent | null> {
		const row = await this.db.getFirstAsync<FeedingJoinRow>(
			`${FEEDING_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapFeeding(row) : null
	}

	async findActiveBreastfeeding (
		childId: string,
	): Promise<BreastfeedingEvent | null> {
		const row = await this.db.getFirstAsync<FeedingJoinRow>(
			`${FEEDING_SELECT} AND e.child_id = ? AND e.type = 'breastfeeding'
			 AND e.end_at IS NULL
			 ORDER BY e.start_at DESC LIMIT 1`,
			childId,
		)
		if (!row) {
			return null
		}
		const mapped = mapFeeding(row)
		return mapped.type === 'breastfeeding' ? mapped : null
	}

	async listByChild (childId: string, limit = 100): Promise<FeedingEvent[]> {
		const rows = await this.db.getAllAsync<FeedingJoinRow>(
			`${FEEDING_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapFeeding)
	}

	async listByChildAndLocalDate (
		childId: string,
		localDate: string,
	): Promise<FeedingEvent[]> {
		const rows = await this.db.getAllAsync<FeedingJoinRow>(
			`${FEEDING_SELECT} AND e.child_id = ? AND e.start_local_date = ?
			 ORDER BY e.start_at DESC`,
			childId,
			localDate,
		)
		return rows.map(mapFeeding)
	}

	/** Inclusive start_local_date range for Statistics period loads. */
	async listByChildAndLocalDateRange (
		childId: string,
		startDate: string,
		endDate: string,
	): Promise<FeedingEvent[]> {
		const rows = await this.db.getAllAsync<FeedingJoinRow>(
			`${FEEDING_SELECT} AND e.child_id = ?
			 AND e.start_local_date >= ? AND e.start_local_date <= ?
			 ORDER BY e.start_at ASC`,
			childId,
			startDate,
			endDate,
		)
		return rows.map(mapFeeding)
	}

	async findLatest (childId: string): Promise<FeedingEvent | null> {
		const row = await this.db.getFirstAsync<FeedingJoinRow>(
			`${FEEDING_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT 1`,
			childId,
		)
		return row ? mapFeeding(row) : null
	}

	async startBreastfeeding (
		input: StartBreastfeedingInput,
	): Promise<BreastfeedingEvent> {
		const existing = await this.findActiveBreastfeeding(input.childId)
		if (existing) {
			return existing
		}

		const startedAt = input.startedAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(startedAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'breastfeeding', ?, NULL, ?, NULL, NULL, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_feeding (
					event_id, feeding_kind, side, amount_ml, duration_seconds, food_name,
					left_duration_seconds, right_duration_seconds, initial_side, last_side,
					side_started_at, bottle_content, amount_text, reaction
				) VALUES (?, 'breastfeeding', ?, NULL, NULL, NULL, 0, 0, ?, ?, ?, NULL, NULL, NULL)`,
				id,
				input.side,
				input.side,
				input.side,
				start.startAt,
			)
		})

		const created = await this.getById(id)
		if (!created || created.type !== 'breastfeeding') {
			throw new Error('Failed to start breastfeeding')
		}
		return created
	}

	async switchBreastSide (
		eventId: string,
		nextSide: BreastSide,
		at?: string,
	): Promise<BreastfeedingEvent> {
		const existing = await this.findBreastfeedingOrThrow(eventId)
		if (existing.endAt != null) {
			throw new FeedingValidationError('Кормление уже завершено')
		}
		if (existing.lastSide === nextSide) {
			return existing
		}
		if (!existing.sideStartedAt) {
			throw new FeedingValidationError('Нет активного сегмента стороны')
		}

		const switchAt = at ?? toOffsetDateTime(new Date())
		const segmentSeconds = Math.max(
			0,
			Math.floor(
				(parseOffsetDateTime(switchAt).getTime() -
					parseOffsetDateTime(existing.sideStartedAt).getTime()) /
					1000,
			),
		)
		const next = addSideSegment(
			existing.leftDurationSeconds,
			existing.rightDurationSeconds,
			existing.lastSide,
			segmentSeconds,
		)
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE event_feeding SET
					left_duration_seconds = ?, right_duration_seconds = ?,
					last_side = ?, side_started_at = ?
				 WHERE event_id = ?`,
				next.leftDurationSeconds,
				next.rightDurationSeconds,
				nextSide,
				switchAt,
				eventId,
			)
			await tx.runAsync(
				`UPDATE events SET updated_at = ? WHERE id = ?`,
				audit,
				eventId,
			)
		})

		return this.findBreastfeedingOrThrow(eventId)
	}

	async finishBreastfeeding (
		eventId: string,
		endedAt?: string,
	): Promise<BreastfeedingEvent> {
		const existing = await this.findBreastfeedingOrThrow(eventId)
		if (existing.endAt != null) {
			throw new FeedingValidationError('Кормление уже завершено')
		}

		const endInstant = endedAt ?? toOffsetDateTime(new Date())
		let left = existing.leftDurationSeconds
		let right = existing.rightDurationSeconds
		if (existing.sideStartedAt) {
			const segment = Math.max(
				0,
				Math.floor(
					(parseOffsetDateTime(endInstant).getTime() -
						parseOffsetDateTime(existing.sideStartedAt).getTime()) /
						1000,
				),
			)
			const next = addSideSegment(left, right, existing.lastSide, segment)
			left = next.leftDurationSeconds
			right = next.rightDurationSeconds
		}

		const end = buildEventEnd(parseOffsetDateTime(endInstant))
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET end_at = ?, end_local_date = ?, updated_at = ?
				 WHERE id = ?`,
				end.endAt,
				end.endLocalDate,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_feeding SET
					left_duration_seconds = ?, right_duration_seconds = ?,
					side_started_at = NULL, duration_seconds = ?
				 WHERE event_id = ?`,
				left,
				right,
				left + right,
				eventId,
			)
		})

		return this.findBreastfeedingOrThrow(eventId)
	}

	async createManualBreastfeeding (
		input: ManualBreastfeedingInput,
	): Promise<BreastfeedingEvent> {
		assertNonNegativeSeconds(input.leftDurationSeconds, 'левая')
		assertNonNegativeSeconds(input.rightDurationSeconds, 'правая')
		if (parseOffsetDateTime(input.endAt).getTime() < parseOffsetDateTime(input.startAt).getTime()) {
			throw new FeedingValidationError('Окончание раньше начала')
		}

		const id = await createEntityId()
		const audit = nowUtcInstant()
		const startLocal = localDateFromOffsetDateTime(input.startAt)
		const endLocal = localDateFromOffsetDateTime(input.endAt)
		const initial = input.initialSide ?? 'left'
		const total = input.leftDurationSeconds + input.rightDurationSeconds

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'breastfeeding', ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				input.startAt,
				input.endAt,
				startLocal,
				endLocal,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_feeding (
					event_id, feeding_kind, side, amount_ml, duration_seconds, food_name,
					left_duration_seconds, right_duration_seconds, initial_side, last_side,
					side_started_at, bottle_content, amount_text, reaction
				) VALUES (?, 'breastfeeding', ?, NULL, ?, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
				id,
				initial,
				total,
				input.leftDurationSeconds,
				input.rightDurationSeconds,
				initial,
				initial,
			)
		})

		return this.findBreastfeedingOrThrow(id)
	}

	async createBottle (input: CreateBottleInput): Promise<BottleEvent> {
		assertPositiveMl(input.amountMl, MAX_BOTTLE_ML, 'бутылочки')
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()
		const kind: FeedingKind = input.content

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'bottle', ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_feeding (
					event_id, feeding_kind, side, amount_ml, duration_seconds, food_name,
					left_duration_seconds, right_duration_seconds, initial_side, last_side,
					side_started_at, bottle_content, amount_text, reaction
				) VALUES (?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL)`,
				id,
				kind,
				input.amountMl,
				input.content,
			)
		})

		const created = await this.getById(id)
		if (!created || created.type !== 'bottle') {
			throw new Error('Failed to create bottle feeding')
		}
		return created
	}

	async createPumping (input: CreatePumpingInput): Promise<PumpingEvent> {
		if (input.amountMl != null) {
			assertPositiveMl(input.amountMl, MAX_PUMP_ML, 'сцеживания')
		}
		if (input.durationSeconds != null) {
			assertNonNegativeSeconds(input.durationSeconds, 'сцеживание')
		}
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const endAt = input.endAt ?? start.startAt
		const endLocal = localDateFromOffsetDateTime(endAt)
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'pumping', ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				endAt,
				start.startLocalDate,
				endLocal,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_feeding (
					event_id, feeding_kind, side, amount_ml, duration_seconds, food_name,
					left_duration_seconds, right_duration_seconds, initial_side, last_side,
					side_started_at, bottle_content, amount_text, reaction
				) VALUES (?, 'pumping', ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
				id,
				input.side ?? null,
				input.amountMl ?? null,
				input.durationSeconds ?? null,
			)
		})

		const created = await this.getById(id)
		if (!created || created.type !== 'pumping') {
			throw new Error('Failed to create pumping')
		}
		return created
	}

	async createWater (input: CreateWaterInput): Promise<WaterEvent> {
		assertPositiveMl(input.amountMl, MAX_WATER_ML, 'воды')
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'water', ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_feeding (
					event_id, feeding_kind, side, amount_ml, duration_seconds, food_name,
					left_duration_seconds, right_duration_seconds, initial_side, last_side,
					side_started_at, bottle_content, amount_text, reaction
				) VALUES (?, 'water', NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
				id,
				input.amountMl,
			)
		})

		const created = await this.getById(id)
		if (!created || created.type !== 'water') {
			throw new Error('Failed to create water')
		}
		return created
	}

	async createSolid (input: CreateSolidInput): Promise<SolidFoodEvent> {
		const name = input.foodName.trim()
		if (!name) {
			throw new FeedingValidationError('Укажите продукт')
		}
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'solid_food', ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_feeding (
					event_id, feeding_kind, side, amount_ml, duration_seconds, food_name,
					left_duration_seconds, right_duration_seconds, initial_side, last_side,
					side_started_at, bottle_content, amount_text, reaction
				) VALUES (?, 'solid_food', NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
				id,
				name,
				input.amountText?.trim() || null,
				input.reaction ?? null,
			)
			await this.upsertRecentFoodTx(tx, input.childId, name, audit)
		})

		const created = await this.getById(id)
		if (!created || created.type !== 'solid_food') {
			throw new Error('Failed to create solid food')
		}
		return created
	}

	async listRecentFoods (childId: string, limit = 12): Promise<string[]> {
		const rows = await this.db.getAllAsync<{ name: string }>(
			`SELECT name FROM recent_foods
			 WHERE child_id = ?
			 ORDER BY last_used_at DESC, use_count DESC
			 LIMIT ?`,
			childId,
			limit,
		)
		return rows.map((r) => r.name)
	}

	async updateBreastfeeding (
		eventId: string,
		input: {
			startAt?: string
			endAt?: string | null
			leftDurationSeconds?: number
			rightDurationSeconds?: number
			notes?: string | null
		},
	): Promise<BreastfeedingEvent> {
		const existing = await this.findBreastfeedingOrThrow(eventId)
		const startAt = input.startAt ?? existing.startAt
		const endAt =
			input.endAt !== undefined ? input.endAt : existing.endAt
		const left =
			input.leftDurationSeconds ?? existing.leftDurationSeconds
		const right =
			input.rightDurationSeconds ?? existing.rightDurationSeconds
		assertNonNegativeSeconds(left, 'левая')
		assertNonNegativeSeconds(right, 'правая')
		if (endAt != null && parseOffsetDateTime(endAt).getTime() < parseOffsetDateTime(startAt).getTime()) {
			throw new FeedingValidationError('Окончание раньше начала')
		}
		const audit = nowUtcInstant()
		const startLocal = localDateFromOffsetDateTime(startAt)
		const endLocal = endAt ? localDateFromOffsetDateTime(endAt) : null
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				startAt,
				endAt,
				startLocal,
				endLocal,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_feeding SET
					left_duration_seconds = ?, right_duration_seconds = ?,
					duration_seconds = ?, side_started_at = CASE WHEN ? IS NULL THEN side_started_at ELSE NULL END
				 WHERE event_id = ?`,
				left,
				right,
				left + right,
				endAt,
				eventId,
			)
		})

		return this.findBreastfeedingOrThrow(eventId)
	}

	async updateBottle (
		eventId: string,
		input: {
			occurredAt?: string
			content?: BottleContent
			amountMl?: number
			notes?: string | null
		},
	): Promise<BottleEvent> {
		const existing = await this.getById(eventId)
		if (!existing || existing.type !== 'bottle') {
			throw new FeedingValidationError('Запись бутылочки не найдена')
		}
		const amount = input.amountMl ?? existing.amountMl
		assertPositiveMl(amount, MAX_BOTTLE_ML, 'бутылочки')
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const content = input.content ??
			(existing.feedingKind === 'formula' ? 'formula' : 'expressed_milk')
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_feeding SET
					feeding_kind = ?, amount_ml = ?, bottle_content = ?
				 WHERE event_id = ?`,
				content,
				amount,
				content,
				eventId,
			)
		})

		const updated = await this.getById(eventId)
		if (!updated || updated.type !== 'bottle') {
			throw new Error('Failed to update bottle')
		}
		return updated
	}

	async updateWater (
		eventId: string,
		input: { occurredAt?: string; amountMl?: number; notes?: string | null },
	): Promise<WaterEvent> {
		const existing = await this.getById(eventId)
		if (!existing || existing.type !== 'water') {
			throw new FeedingValidationError('Запись воды не найдена')
		}
		const amount = input.amountMl ?? existing.amountMl
		assertPositiveMl(amount, MAX_WATER_ML, 'воды')
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_feeding SET amount_ml = ? WHERE event_id = ?`,
				amount,
				eventId,
			)
		})

		const updated = await this.getById(eventId)
		if (!updated || updated.type !== 'water') {
			throw new Error('Failed to update water')
		}
		return updated
	}

	async updateSolid (
		eventId: string,
		input: {
			foodName?: string
			amountText?: string | null
			reaction?: SolidReaction | null
			occurredAt?: string
			notes?: string | null
		},
	): Promise<SolidFoodEvent> {
		const existing = await this.getById(eventId)
		if (!existing || existing.type !== 'solid_food') {
			throw new FeedingValidationError('Запись прикорма не найдена')
		}
		const foodName = (input.foodName ?? existing.foodName).trim()
		if (!foodName) {
			throw new FeedingValidationError('Укажите продукт')
		}
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const amountText =
			input.amountText !== undefined
				? input.amountText?.trim() || null
				: existing.amountText
		const reaction =
			input.reaction !== undefined ? input.reaction : existing.reaction
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_feeding SET food_name = ?, amount_text = ?, reaction = ?
				 WHERE event_id = ?`,
				foodName,
				amountText,
				reaction,
				eventId,
			)
			await this.upsertRecentFoodTx(tx, existing.childId, foodName, audit)
		})

		const updated = await this.getById(eventId)
		if (!updated || updated.type !== 'solid_food') {
			throw new Error('Failed to update solid')
		}
		return updated
	}

	async updatePumping (
		eventId: string,
		input: {
			occurredAt?: string
			side?: BreastSide | 'both' | null
			durationSeconds?: number | null
			amountMl?: number | null
			notes?: string | null
		},
	): Promise<PumpingEvent> {
		const existing = await this.getById(eventId)
		if (!existing || existing.type !== 'pumping') {
			throw new FeedingValidationError('Запись сцеживания не найдена')
		}
		const amount =
			input.amountMl !== undefined ? input.amountMl : existing.amountMl
		if (amount != null) {
			assertPositiveMl(amount, MAX_PUMP_ML, 'сцеживания')
		}
		const duration =
			input.durationSeconds !== undefined
				? input.durationSeconds
				: existing.durationSeconds
		if (duration != null) {
			assertNonNegativeSeconds(duration, 'сцеживание')
		}
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const side = input.side !== undefined ? input.side : existing.side
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_feeding SET side = ?, amount_ml = ?, duration_seconds = ?
				 WHERE event_id = ?`,
				side,
				amount,
				duration,
				eventId,
			)
		})

		const updated = await this.getById(eventId)
		if (!updated || updated.type !== 'pumping') {
			throw new Error('Failed to update pumping')
		}
		return updated
	}

	async delete (eventId: string): Promise<void> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new FeedingValidationError('Запись кормления не найдена')
		}
		await this.db.runAsync('DELETE FROM events WHERE id = ?', eventId)
	}

	private async findBreastfeedingOrThrow (
		eventId: string,
	): Promise<BreastfeedingEvent> {
		const existing = await this.getById(eventId)
		if (!existing || existing.type !== 'breastfeeding') {
			throw new FeedingValidationError('Запись грудного кормления не найдена')
		}
		return existing
	}

	private async upsertRecentFoodTx (
		tx: SqlExecutor,
		childId: string,
		name: string,
		at: string,
	): Promise<void> {
		const existing = await tx.getFirstAsync<{ id: string; use_count: number }>(
			`SELECT id, use_count FROM recent_foods WHERE child_id = ? AND name = ?`,
			childId,
			name,
		)
		if (existing) {
			await tx.runAsync(
				`UPDATE recent_foods SET last_used_at = ?, use_count = ? WHERE id = ?`,
				at,
				existing.use_count + 1,
				existing.id,
			)
			return
		}
		await tx.runAsync(
			`INSERT INTO recent_foods (id, child_id, name, last_used_at, use_count)
			 VALUES (?, ?, ?, ?, 1)`,
			await createEntityId(),
			childId,
			name,
			at,
		)
	}
}

/** Re-export for UI live totals without pulling repository. */
export { breastfeedingLiveTotals }
