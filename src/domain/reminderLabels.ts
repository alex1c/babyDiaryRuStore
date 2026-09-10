/**
 * Russian labels for reminders UI and notifications.
 */

import type { Reminder, ReminderScheduleType, ReminderType, Weekday } from '../models/reminder'

export function reminderTypeLabel (type: ReminderType): string {
	switch (type) {
		case 'feeding':
			return 'Кормление'
		case 'medicine':
			return 'Лекарство'
		case 'vitamin':
			return 'Витамин'
		case 'measurement':
			return 'Измерение'
		case 'doctor':
			return 'Врач'
		case 'custom':
			return 'Своё'
		case 'no_feeding':
			return 'Нет кормления'
	}
}

export function reminderScheduleLabel (reminder: Reminder): string {
	switch (reminder.scheduleType) {
		case 'once':
			return reminder.fireAt
				? `Разово · ${formatFireAtShort(reminder.fireAt)}`
				: 'Разово'
		case 'daily':
			return reminder.timeLocal
				? `Каждый день в ${reminder.timeLocal}`
				: 'Каждый день'
		case 'weekly':
			return formatWeeklyLabel(reminder.daysOfWeek, reminder.timeLocal)
		case 'interval_hours':
			return reminder.intervalHours != null
				? `Если кормления не было ${formatHoursRu(reminder.intervalHours)}`
				: 'По интервалу'
	}
}

export function formatHoursRu (hours: number): string {
	if (Number.isInteger(hours)) {
		return `${hours} ч`
	}
	return `${String(hours).replace('.', ',')} ч`
}

function formatWeeklyLabel (
	days: Weekday[] | null,
	timeLocal: string | null,
): string {
	const dayPart = days && days.length > 0
		? days.map(weekdayShortRu).join(', ')
		: 'выбранные дни'
	const timePart = timeLocal ? ` в ${timeLocal}` : ''
	return `${dayPart}${timePart}`
}

export function weekdayShortRu (day: Weekday): string {
	switch (day) {
		case 1:
			return 'пн'
		case 2:
			return 'вт'
		case 3:
			return 'ср'
		case 4:
			return 'чт'
		case 5:
			return 'пт'
		case 6:
			return 'сб'
		case 7:
			return 'вс'
	}
}

function formatFireAtShort (fireAt: string): string {
	// Keep ISO offset datetime readable: YYYY-MM-DD HH:MM
	const m = fireAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
	if (m) {
		return `${m[1]} ${m[2]}`
	}
	return fireAt
}

/** Neutral notification title — include child name when known. */
export function buildReminderNotificationTitle (
	reminder: Reminder,
	childName: string | null = null,
): string {
	if (childName && childName.trim()) {
		return `${childName.trim()} · ${reminder.title}`
	}
	return reminder.title
}

/** Neutral notification body — never a medical order. */
export function buildReminderNotificationBody (
	reminder: Reminder,
	childName: string | null = null,
): string {
	if (reminder.type === 'no_feeding' && reminder.intervalHours != null) {
		const base = `Последнее кормление было ${formatHoursRu(reminder.intervalHours)} назад`
		if (childName && childName.trim()) {
			return `${childName.trim()} · ${base}`
		}
		return base
	}
	if (reminder.doseText) {
		return `${reminder.title} · ${reminder.doseText} (напоминание, установленное вами)`
	}
	if (reminder.type === 'medicine' || reminder.type === 'vitamin') {
		return `${reminder.title} · напоминание, установленное вами`
	}
	return reminder.title
}

export function reminderScheduleTypeLabel (type: ReminderScheduleType): string {
	switch (type) {
		case 'once':
			return 'Разово'
		case 'daily':
			return 'Каждый день'
		case 'weekly':
			return 'По дням недели'
		case 'interval_hours':
			return 'Интервал без кормления'
	}
}
