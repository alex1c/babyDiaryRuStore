/**
 * Active child persistence through settings + repository create/update.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import {
	findChildById,
	needsOnboarding,
	resolveActiveChildId,
} from '../src/domain/onboarding'
import { ChildRepository } from '../src/repositories/childRepository'
import { SettingsRepository } from '../src/repositories/settingsRepository'

function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(1)
	return {
		db,
		children: new ChildRepository(db),
		settings: new SettingsRepository(db),
	}
}

describe('active child selection flow', () => {
	it('creates a child, stores activeChildId, and reloads it', async () => {
		const { children, settings } = setup()
		expect(needsOnboarding(await children.listAll())).toBe(true)

		const created = await children.create({
			name: 'Лёва',
			birthDate: '2026-03-01',
			birthWeightGrams: 3100,
		})
		await settings.setActiveChildId(created.id)
		await settings.setOnboardingCompleted(true)

		const list = await children.listAll()
		const appSettings = await settings.get()
		expect(needsOnboarding(list)).toBe(false)

		const activeId = resolveActiveChildId(list, appSettings.activeChildId)
		expect(activeId).toBe(created.id)
		expect(findChildById(list, activeId)?.name).toBe('Лёва')
		expect(appSettings.onboardingCompleted).toBe(true)
	})

	it('updates an existing child without creating another', async () => {
		const { children, settings } = setup()
		const created = await children.create({
			name: 'Мила',
			birthDate: '2026-01-15',
		})
		await settings.setActiveChildId(created.id)

		const updated = await children.update(created.id, {
			name: 'Людмила',
			birthHeightCm: 50,
			sex: 'female',
		})

		expect(updated.id).toBe(created.id)
		expect(updated.name).toBe('Людмила')
		expect(updated.birthHeightCm).toBe(50)
		expect(await children.listAll()).toHaveLength(1)
	})

	it('rejects future birth dates on create', async () => {
		const { children } = setup()
		await expect(
			children.create({
				name: 'Будущий',
				birthDate: '2099-01-01',
			}),
		).rejects.toThrow(/future/i)
	})
})
