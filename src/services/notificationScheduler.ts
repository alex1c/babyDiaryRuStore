/**
 * Notification scheduler abstraction — Expo implementation + in-memory for tests.
 */

import { Linking, Platform } from 'react-native'

export type PermissionStatus = 'granted' | 'denied' | 'undetermined'

export interface NotificationContent {
	title: string
	body: string
	data?: Record<string, string>
}

export interface OnceSchedule {
	kind: 'once'
	/** Absolute Date when to fire (local timezone). */
	date: Date
}

export interface DailySchedule {
	kind: 'daily'
	hour: number
	minute: number
}

export interface WeeklySchedule {
	kind: 'weekly'
	weekday: number
	hour: number
	minute: number
}

export type NotificationSchedule =
	| OnceSchedule
	| DailySchedule
	| WeeklySchedule

export interface NotificationScheduler {
	getPermissions (): Promise<PermissionStatus>
	requestPermissions (): Promise<PermissionStatus>
	ensureAndroidChannel (): Promise<void>
	schedule (
		content: NotificationContent,
		schedule: NotificationSchedule,
	): Promise<string>
	cancel (platformId: string): Promise<void>
	getAllScheduledIds (): Promise<string[]>
	openSystemSettings (): Promise<void>
}

/** In-memory scheduler for Jest (no native module). */
export class MemoryNotificationScheduler implements NotificationScheduler {
	permission: PermissionStatus = 'undetermined'
	scheduled = new Map<
		string,
		{ content: NotificationContent; schedule: NotificationSchedule }
	>()
	private seq = 0

	async getPermissions (): Promise<PermissionStatus> {
		return this.permission
	}

	async requestPermissions (): Promise<PermissionStatus> {
		if (this.permission === 'undetermined') {
			this.permission = 'granted'
		}
		return this.permission
	}

	async ensureAndroidChannel (): Promise<void> {
		// no-op in memory
	}

	async schedule (
		content: NotificationContent,
		schedule: NotificationSchedule,
	): Promise<string> {
		this.seq += 1
		const id = `mem-notif-${this.seq}`
		this.scheduled.set(id, { content, schedule })
		return id
	}

	async cancel (platformId: string): Promise<void> {
		this.scheduled.delete(platformId)
	}

	async getAllScheduledIds (): Promise<string[]> {
		return [...this.scheduled.keys()]
	}

	async openSystemSettings (): Promise<void> {
		// no-op
	}
}

let singleton: NotificationScheduler | null = null

export function setNotificationSchedulerForTests (
	scheduler: NotificationScheduler | null,
): void {
	singleton = scheduler
}

export function getNotificationScheduler (): NotificationScheduler {
	if (singleton) {
		return singleton
	}
	singleton = createExpoNotificationScheduler()
	return singleton
}

function createExpoNotificationScheduler (): NotificationScheduler {
	// Lazy require so Jest can use MemoryNotificationScheduler without native.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const Notifications = require('expo-notifications') as typeof import('expo-notifications')

	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: true,
			shouldShowList: true,
			shouldPlaySound: true,
			shouldSetBadge: false,
		}),
	})

	return {
		async getPermissions () {
			const { status } = await Notifications.getPermissionsAsync()
			return mapStatus(status)
		},
		async requestPermissions () {
			const { status } = await Notifications.requestPermissionsAsync()
			return mapStatus(status)
		},
		async ensureAndroidChannel () {
			if (Platform.OS === 'android') {
				await Notifications.setNotificationChannelAsync('baby-diary', {
					name: 'Напоминания',
					importance: Notifications.AndroidImportance.DEFAULT,
				})
			}
		},
		async schedule (content, schedule) {
			const trigger = toExpoTrigger(Notifications, schedule)
			return Notifications.scheduleNotificationAsync({
				content: {
					title: content.title,
					body: content.body,
					data: content.data,
					sound: true,
				},
				trigger,
			})
		},
		async cancel (platformId) {
			await Notifications.cancelScheduledNotificationAsync(platformId)
		},
		async getAllScheduledIds () {
			const all = await Notifications.getAllScheduledNotificationsAsync()
			return all.map((n) => n.identifier)
		},
		async openSystemSettings () {
			await Linking.openSettings()
		},
	}
}

function mapStatus (status: string): PermissionStatus {
	if (status === 'granted') {
		return 'granted'
	}
	if (status === 'denied') {
		return 'denied'
	}
	return 'undetermined'
}

function toExpoTrigger (
	Notifications: typeof import('expo-notifications'),
	schedule: NotificationSchedule,
): import('expo-notifications').NotificationTriggerInput {
	if (schedule.kind === 'once') {
		return {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: schedule.date,
		}
	}
	if (schedule.kind === 'daily') {
		return {
			type: Notifications.SchedulableTriggerInputTypes.DAILY,
			hour: schedule.hour,
			minute: schedule.minute,
		}
	}
	return {
		type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
		weekday: schedule.weekday,
		hour: schedule.hour,
		minute: schedule.minute,
	}
}
