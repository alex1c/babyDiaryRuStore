/**
 * Event repository tests — base event CRUD and backdated edits.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { ChildRepository } from '../src/repositories/childRepository'
import { EventRepository } from '../src/repositories/eventRepository'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(1)
	const children = new ChildRepository(db)
	const events = new EventRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2025-05-01',
	})
	return { db, events, childId: child.id }
}

describe('EventRepository', () => {
	it('creates a point event and lists by local date', async () => {
		const { events, childId } = await setup()
		const event = await events.create({
			childId,
			type: 'diaper',
			startAt: '2026-03-15T09:30:00+03:00',
			startLocalDate: '2026-03-15',
			notes: 'мокр',
		})

		expect(event.type).toBe('diaper')
		expect(event.endAt).toBeNull()

		const day = await events.listByChildAndLocalDate(childId, '2026-03-15')
		expect(day).toHaveLength(1)
		expect(day[0]?.id).toBe(event.id)
	})

	it('supports duration events that cross midnight', async () => {
		const { events, childId } = await setup()
		const sleep = await events.create({
			childId,
			type: 'sleep',
			startAt: '2026-03-14T22:00:00+03:00',
			startLocalDate: '2026-03-14',
			endAt: '2026-03-15T06:30:00+03:00',
			endLocalDate: '2026-03-15',
		})

		expect(sleep.startLocalDate).toBe('2026-03-14')
		expect(sleep.endLocalDate).toBe('2026-03-15')
	})

	it('allows backdated edits of start/end', async () => {
		const { events, childId } = await setup()
		const event = await events.create({
			childId,
			type: 'bottle',
			startAt: '2026-03-15T12:00:00+03:00',
			startLocalDate: '2026-03-15',
		})

		const updated = await events.update(event.id, {
			startAt: '2026-03-15T11:40:00+03:00',
			startLocalDate: '2026-03-15',
			notes: 'исправлено',
		})

		expect(updated.startAt).toBe('2026-03-15T11:40:00+03:00')
		expect(updated.notes).toBe('исправлено')
	})

	it('rejects end before start', async () => {
		const { events, childId } = await setup()
		await expect(
			events.create({
				childId,
				type: 'walk',
				startAt: '2026-03-15T12:00:00+03:00',
				startLocalDate: '2026-03-15',
				endAt: '2026-03-15T11:00:00+03:00',
				endLocalDate: '2026-03-15',
			}),
		).rejects.toThrow(/endAt must be >= startAt/)
	})

	it('rejects mismatched local date vs startAt civil date', async () => {
		const { events, childId } = await setup()
		await expect(
			events.create({
				childId,
				type: 'temperature',
				startAt: '2026-03-15T23:30:00+03:00',
				startLocalDate: '2026-03-16',
			}),
		).rejects.toThrow(/startLocalDate must match/)
	})
})
