/**
 * Child repository tests.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { ChildRepository } from '../src/repositories/childRepository'

function createRepo (): ChildRepository {
	const db = new MemorySqlExecutor()
	db.markMigrated(1)
	return new ChildRepository(db)
}

describe('ChildRepository', () => {
	it('creates and reads a child', async () => {
		const repo = createRepo()
		const child = await repo.create({
			name: '  Алиса  ',
			birthDate: '2025-11-02',
			sex: 'female',
			birthWeightGrams: 3200,
		})

		expect(child.id).toMatch(
			/^00000000-0000-4000-8000-000000000001$/,
		)
		expect(child.name).toBe('Алиса')
		expect(child.birthDate).toBe('2025-11-02')
		expect(child.isActive).toBe(true)

		const loaded = await repo.getById(child.id)
		expect(loaded).toEqual(child)
	})

	it('lists children with active first', async () => {
		const repo = createRepo()
		await repo.create({
			name: 'Боря',
			birthDate: '2025-01-01',
			isActive: false,
		})
		await repo.create({
			name: 'Аня',
			birthDate: '2025-02-01',
			isActive: true,
		})

		const list = await repo.listAll()
		expect(list.map((c) => c.name)).toEqual(['Аня', 'Боря'])
	})

	it('updates and deletes a child', async () => {
		const repo = createRepo()
		const child = await repo.create({
			name: 'Миша',
			birthDate: '2024-06-15',
		})

		const updated = await repo.update(child.id, {
			name: 'Михаил',
			birthHeightCm: 52,
		})
		expect(updated.name).toBe('Михаил')
		expect(updated.birthHeightCm).toBe(52)

		await repo.delete(child.id)
		expect(await repo.getById(child.id)).toBeNull()
	})

	it('rejects invalid birthDate', async () => {
		const repo = createRepo()
		await expect(
			repo.create({ name: 'X', birthDate: '15-01-2025' }),
		).rejects.toThrow(/Invalid birthDate/)
	})
})
