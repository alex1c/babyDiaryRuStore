/**
 * Health attachment metadata — managed file URIs only.
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import type {
	HealthAttachment,
	HealthAttachmentOwnerKind,
} from '../models/health'
import type { PhotoStorage } from '../services/photoStorage'
import { nowUtcInstant } from '../utils/datetime'

export interface CreateAttachmentInput {
	childId: string
	ownerKind: HealthAttachmentOwnerKind
	ownerId: string
	/** Already-managed file URI. */
	fileUri: string
	mimeHint?: string | null
	title?: string | null
}

interface AttachmentRow {
	id: string
	child_id: string
	owner_kind: string
	owner_id: string
	file_uri: string
	mime_hint: string | null
	title: string | null
	created_at: string
	updated_at: string
}

const ATTACH_SELECT = `
	SELECT id, child_id, owner_kind, owner_id, file_uri, mime_hint, title,
	       created_at, updated_at
	FROM health_attachments
`

function mapAttachment (row: AttachmentRow): HealthAttachment {
	return {
		id: row.id,
		childId: row.child_id,
		ownerKind: row.owner_kind as HealthAttachmentOwnerKind,
		ownerId: row.owner_id,
		fileUri: row.file_uri,
		mimeHint: row.mime_hint,
		title: row.title,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class HealthAttachmentRepository {
	constructor (
		private readonly db: SqlExecutor,
		private readonly files: PhotoStorage,
	) {}

	async getById (id: string): Promise<HealthAttachment | null> {
		const row = await this.db.getFirstAsync<AttachmentRow>(
			`${ATTACH_SELECT} WHERE id = ?`,
			id,
		)
		return row ? mapAttachment(row) : null
	}

	async listByOwner (
		ownerKind: HealthAttachmentOwnerKind,
		ownerId: string,
	): Promise<HealthAttachment[]> {
		const rows = await this.db.getAllAsync<AttachmentRow>(
			`${ATTACH_SELECT} WHERE owner_kind = ? AND owner_id = ?
			 ORDER BY created_at DESC`,
			ownerKind,
			ownerId,
		)
		return rows.map(mapAttachment)
	}

	async listByChild (childId: string): Promise<HealthAttachment[]> {
		const rows = await this.db.getAllAsync<AttachmentRow>(
			`${ATTACH_SELECT} WHERE child_id = ?
			 ORDER BY created_at DESC`,
			childId,
		)
		return rows.map(mapAttachment)
	}

	async create (input: CreateAttachmentInput): Promise<HealthAttachment> {
		const id = await createEntityId()
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`INSERT INTO health_attachments (
				id, child_id, owner_kind, owner_id, file_uri, mime_hint, title,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			input.childId,
			input.ownerKind,
			input.ownerId,
			input.fileUri,
			input.mimeHint ?? null,
			input.title?.trim() || null,
			audit,
			audit,
		)
		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create attachment')
		}
		return created
	}

	async delete (id: string): Promise<void> {
		const existing = await this.getById(id)
		if (!existing) {
			return
		}
		await this.db.runAsync('DELETE FROM health_attachments WHERE id = ?', id)
		await this.maybeDeleteUnusedFile(existing.fileUri)
	}

	/** Delete all attachments for an owner (e.g. visit deleted). */
	async deleteByOwner (
		ownerKind: HealthAttachmentOwnerKind,
		ownerId: string,
	): Promise<void> {
		const list = await this.listByOwner(ownerKind, ownerId)
		for (const item of list) {
			await this.delete(item.id)
		}
	}

	async countFileReferences (
		fileUri: string,
		excludeId?: string,
	): Promise<number> {
		const rows = await this.db.getAllAsync<{ id: string }>(
			`SELECT id FROM health_attachments WHERE file_uri = ?`,
			fileUri,
		)
		let count = 0
		for (const row of rows) {
			if (excludeId && row.id === excludeId) {
				continue
			}
			count += 1
		}
		const symptoms = await this.db.getAllAsync<{ event_id: string }>(
			`SELECT event_id FROM event_symptom WHERE photo_uri = ?`,
			fileUri,
		)
		count += symptoms.length
		return count
	}

	private async maybeDeleteUnusedFile (fileUri: string): Promise<void> {
		if (!this.files.isManaged(fileUri)) {
			return
		}
		const refs = await this.countFileReferences(fileUri)
		if (refs === 0) {
			await this.files.deleteManaged(fileUri)
		}
	}
}
