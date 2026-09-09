/**
 * Phase 7 — health tracking: temperature, symptoms, medicines, visits, report.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { buildHealthReportData } from '../src/domain/healthReport'
import { QuickEventValidationError } from '../src/domain/quickEventLabels'
import { ChildRepository } from '../src/repositories/childRepository'
import { DoctorVisitRepository } from '../src/repositories/doctorVisitRepository'
import { HealthAttachmentRepository } from '../src/repositories/healthAttachmentRepository'
import { MedicineCatalogRepository } from '../src/repositories/medicineCatalogRepository'
import { QuickEventRepository } from '../src/repositories/quickEventRepository'
import { SymptomRepository } from '../src/repositories/symptomRepository'
import { createMemoryPhotoStorage } from '../src/services/photoStorage'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2026-01-15',
	})
	const healthDocs = createMemoryPhotoStorage('health-documents/')
	return {
		db,
		childId: child.id,
		quickEvents: new QuickEventRepository(db),
		symptoms: new SymptomRepository(db, healthDocs),
		catalog: new MedicineCatalogRepository(db),
		visits: new DoctorVisitRepository(db),
		attachments: new HealthAttachmentRepository(db, healthDocs),
		photos: healthDocs,
	}
}

describe('Temperature', () => {
	it('supports decimal comma, edit, delete, sorted history', async () => {
		const { quickEvents, childId } = await setup()
		const a = await quickEvents.createTemperature({
			childId,
			celsiusRaw: '37,4',
			method: 'axillary',
			occurredAt: '2026-09-09T18:40:00+03:00',
		})
		expect(a.celsius).toBe(37.4)
		expect(a.method).toBe('axillary')
		await quickEvents.createTemperature({
			childId,
			celsiusRaw: '38,1',
			occurredAt: '2026-09-09T14:10:00+03:00',
		})
		const list = await quickEvents.listTemperaturesByChild(childId)
		expect(list[0]?.celsius).toBe(37.4)
		expect(list[1]?.celsius).toBe(38.1)
		const edited = await quickEvents.updateTemperature(a.id, {
			celsiusRaw: '37,5',
		})
		expect(edited.celsius).toBe(37.5)
		await quickEvents.deleteEvent(a.id)
		expect(await quickEvents.getTemperatureById(a.id)).toBeNull()
	})

	it('rejects absurd values softly', async () => {
		const { quickEvents, childId } = await setup()
		await expect(
			quickEvents.createTemperature({ childId, celsiusRaw: '50' }),
		).rejects.toBeInstanceOf(QuickEventValidationError)
	})
})

describe('Symptoms', () => {
	it('creates, stays active, resolves, edits, custom, photo', async () => {
		const { symptoms, photos, childId } = await setup()
		const uri = await photos.importFromUri('file://rash.jpg')
		const created = await symptoms.create({
			childId,
			symptomType: 'rash',
			severity: 'mild',
			photoUri: uri,
			startedAt: '2026-09-07T10:00:00+03:00',
		})
		expect(created.resolvedAt).toBeNull()
		expect(created.photoUri).toBe(uri)
		const active = await symptoms.listActive(childId)
		expect(active).toHaveLength(1)

		const custom = await symptoms.create({
			childId,
			symptomType: 'other',
			customLabel: 'Икота',
		})
		expect(custom.title).toBe('Икота')

		const resolved = await symptoms.resolve(created.id)
		expect(resolved.resolvedAt).not.toBeNull()
		const stillActive = await symptoms.listActive(childId)
		expect(stillActive).toHaveLength(1)
		expect(stillActive[0]?.id).toBe(custom.id)

		const edited = await symptoms.update(custom.id, {
			notes: 'редко',
		})
		expect(edited.notes).toBe('редко')
		await symptoms.delete(custom.id)
		expect(await symptoms.getById(custom.id)).toBeNull()
	})
})

describe('Medicines catalog and intake', () => {
	it('catalog kinds, intake snapshot, dose/unit, edit/delete', async () => {
		const { catalog, quickEvents, childId } = await setup()
		const item = await catalog.create({
			childId,
			kind: 'medicine',
			name: 'Парацетамол',
			defaultDose: '2,5',
			defaultUnit: 'ml',
		})
		const vitamin = await catalog.create({
			childId,
			kind: 'vitamin',
			name: 'D3',
			defaultDose: '1',
			defaultUnit: 'drops',
		})
		expect(vitamin.kind).toBe('vitamin')

		const intake = await quickEvents.createMedicine({
			childId,
			kind: 'medicine',
			name: item.name,
			doseText: '2,5',
			unit: 'ml',
			catalogId: item.id,
			occurredAt: '2026-09-09T16:20:00+03:00',
		})
		expect(intake.catalogId).toBe(item.id)
		expect(intake.name).toBe('Парацетамол')

		await catalog.update(item.id, { name: 'Панадол' })
		const still = await quickEvents.getMedicineById(intake.id)
		expect(still?.name).toBe('Парацетамол')

		const edited = await quickEvents.updateMedicine(intake.id, {
			doseText: '5',
		})
		expect(edited.doseText).toBe('5')
		const history = await quickEvents.listMedicinesByChild(childId)
		expect(history[0]?.id).toBe(intake.id)
		await quickEvents.deleteEvent(intake.id)
		expect(await quickEvents.getMedicineById(intake.id)).toBeNull()
	})
})

describe('Doctor visits', () => {
	it('create custom specialist, next visit, attachment, edit/delete', async () => {
		const { visits, attachments, photos, childId } = await setup()
		const visit = await visits.create({
			childId,
			specialistKey: 'other',
			specialistCustom: 'Аллерголог',
			reason: 'Плановый осмотр',
			visitedAt: '2026-09-09T14:30:00+03:00',
			nextVisitAt: '2026-10-09T14:30:00+03:00',
		})
		expect(visit.specialistLabel).toBe('Аллерголог')
		expect(visit.nextVisitLocalDate).toBe('2026-10-09')

		const uri = await photos.importFromUri('file://doc.jpg')
		const att = await attachments.create({
			childId,
			ownerKind: 'visit',
			ownerId: visit.id,
			fileUri: uri,
		})
		expect(att.fileUri).toBe(uri)

		const edited = await visits.update(visit.id, {
			reason: 'Контроль',
		})
		expect(edited.reason).toBe('Контроль')

		await attachments.deleteByOwner('visit', visit.id)
		expect(photos.files.has(uri)).toBe(false)
		await visits.delete(visit.id)
		expect(await visits.getById(visit.id)).toBeNull()
	})

	it('keeps shared file when duplicate refs remain', async () => {
		const { visits, attachments, photos, childId } = await setup()
		const uri = await photos.importFromUri('file://shared.jpg')
		const v1 = await visits.create({
			childId,
			specialistKey: 'pediatrician',
		})
		const v2 = await visits.create({
			childId,
			specialistKey: 'ent',
		})
		await attachments.create({
			childId,
			ownerKind: 'visit',
			ownerId: v1.id,
			fileUri: uri,
		})
		await attachments.create({
			childId,
			ownerKind: 'visit',
			ownerId: v2.id,
			fileUri: uri,
		})
		await attachments.deleteByOwner('visit', v1.id)
		expect(photos.files.has(uri)).toBe(true)
		await attachments.deleteByOwner('visit', v2.id)
		expect(photos.files.has(uri)).toBe(false)
	})
})

describe('Health report foundation', () => {
	it('filters period, min/max, empty period', async () => {
		const { quickEvents, symptoms, visits, childId } = await setup()
		await quickEvents.createTemperature({
			childId,
			celsiusRaw: '36,8',
			occurredAt: '2026-09-01T10:00:00+03:00',
		})
		await quickEvents.createTemperature({
			childId,
			celsiusRaw: '38,0',
			occurredAt: '2026-09-05T10:00:00+03:00',
		})
		await symptoms.create({
			childId,
			symptomType: 'cough',
			startedAt: '2026-09-03T10:00:00+03:00',
		})
		await quickEvents.createMedicine({
			childId,
			kind: 'medicine',
			name: 'Сироп',
			doseText: '5',
			unit: 'ml',
			occurredAt: '2026-09-04T10:00:00+03:00',
		})
		await visits.create({
			childId,
			specialistKey: 'pediatrician',
			visitedAt: '2026-09-06T10:00:00+03:00',
		})

		const report = buildHealthReportData({
			periodStart: '2026-09-01',
			periodEnd: '2026-09-30',
			temperatures: await quickEvents.listTemperaturesByChild(childId),
			symptoms: await symptoms.listByChild(childId),
			medicines: await quickEvents.listMedicinesByChild(childId),
			doctorVisits: await visits.listByChild(childId),
		})
		expect(report.temperatures).toHaveLength(2)
		expect(report.temperatureMin).toBe(36.8)
		expect(report.temperatureMax).toBe(38)
		expect(report.symptoms).toHaveLength(1)
		expect(report.medicines).toHaveLength(1)
		expect(report.doctorVisits).toHaveLength(1)

		const empty = buildHealthReportData({
			periodStart: '2026-01-01',
			periodEnd: '2026-01-31',
			temperatures: await quickEvents.listTemperaturesByChild(childId),
			symptoms: await symptoms.listByChild(childId),
			medicines: await quickEvents.listMedicinesByChild(childId),
			doctorVisits: await visits.listByChild(childId),
		})
		expect(empty.temperatures).toHaveLength(0)
		expect(empty.temperatureMin).toBeNull()
	})
})
