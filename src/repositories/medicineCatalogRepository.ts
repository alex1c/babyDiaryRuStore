/**
 * User medicine / vitamin catalog (not a drug reference database).
 */

import type { SqlExecutor } from '../db/types'
import { assertNonEmptyName } from '../domain/quickEventLabels'
import { createEntityId } from '../domain/ids'
import type { MedicineCatalogItem } from '../models/health'
import type { MedicineKind } from '../models/quickEvents'
import { nowUtcInstant } from '../utils/datetime'

export interface CreateCatalogInput {
	childId: string
	kind: MedicineKind
	name: string
	defaultDose?: string | null
	defaultUnit?: string | null
	notes?: string | null
}

export interface UpdateCatalogInput {
	name?: string
	kind?: MedicineKind
	defaultDose?: string | null
	defaultUnit?: string | null
	notes?: string | null
	isActive?: boolean
}

interface CatalogRow {
	id: string
	child_id: string
	kind: string
	name: string
	default_dose: string | null
	default_unit: string | null
	notes: string | null
	is_active: number
	reminder_enabled: number
	created_at: string
	updated_at: string
}

const CATALOG_SELECT = `
	SELECT id, child_id, kind, name, default_dose, default_unit, notes,
	       is_active, reminder_enabled, created_at, updated_at
	FROM medicine_catalog
`

function mapCatalog (row: CatalogRow): MedicineCatalogItem {
	return {
		id: row.id,
		childId: row.child_id,
		kind: row.kind === 'vitamin' ? 'vitamin' : 'medicine',
		name: row.name,
		defaultDose: row.default_dose,
		defaultUnit: row.default_unit,
		notes: row.notes,
		isActive: Number(row.is_active) === 1,
		reminderEnabled: Number(row.reminder_enabled) === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class MedicineCatalogRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<MedicineCatalogItem | null> {
		const row = await this.db.getFirstAsync<CatalogRow>(
			`${CATALOG_SELECT} WHERE id = ?`,
			id,
		)
		return row ? mapCatalog(row) : null
	}

	async listByChild (
		childId: string,
		kind?: MedicineKind,
		activeOnly = true,
	): Promise<MedicineCatalogItem[]> {
		if (kind) {
			const rows = await this.db.getAllAsync<CatalogRow>(
				`${CATALOG_SELECT} WHERE child_id = ? AND kind = ?
				 ${activeOnly ? 'AND is_active = 1' : ''}
				 ORDER BY name COLLATE NOCASE`,
				childId,
				kind,
			)
			return rows.map(mapCatalog)
		}
		const rows = await this.db.getAllAsync<CatalogRow>(
			`${CATALOG_SELECT} WHERE child_id = ?
			 ${activeOnly ? 'AND is_active = 1' : ''}
			 ORDER BY kind, name COLLATE NOCASE`,
			childId,
		)
		return rows.map(mapCatalog)
	}

	async create (input: CreateCatalogInput): Promise<MedicineCatalogItem> {
		const name = assertNonEmptyName(input.name, 'название')
		const id = await createEntityId()
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`INSERT INTO medicine_catalog (
				id, child_id, kind, name, default_dose, default_unit, notes,
				is_active, reminder_enabled, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
			id,
			input.childId,
			input.kind,
			name,
			input.defaultDose?.trim() || null,
			input.defaultUnit?.trim() || null,
			input.notes?.trim() || null,
			audit,
			audit,
		)
		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create catalog item')
		}
		return created
	}

	async update (
		id: string,
		input: UpdateCatalogInput,
	): Promise<MedicineCatalogItem> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Препарат не найден')
		}
		const name =
			input.name !== undefined
				? assertNonEmptyName(input.name, 'название')
				: existing.name
		const kind = input.kind ?? existing.kind
		const defaultDose =
			input.defaultDose !== undefined
				? input.defaultDose?.trim() || null
				: existing.defaultDose
		const defaultUnit =
			input.defaultUnit !== undefined
				? input.defaultUnit?.trim() || null
				: existing.defaultUnit
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const isActive =
			input.isActive !== undefined ? input.isActive : existing.isActive
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`UPDATE medicine_catalog SET
				kind = ?, name = ?, default_dose = ?, default_unit = ?,
				notes = ?, is_active = ?, updated_at = ?
			 WHERE id = ?`,
			kind,
			name,
			defaultDose,
			defaultUnit,
			notes,
			isActive ? 1 : 0,
			audit,
			id,
		)
		const updated = await this.getById(id)
		if (!updated) {
			throw new Error('Failed to update catalog item')
		}
		return updated
	}

	async delete (id: string): Promise<void> {
		// Soft-deactivate so intake history snapshots stay meaningful.
		await this.update(id, { isActive: false })
	}
}
