/**
 * Data-driven in-app training pages (Russian copy only).
 * Navigation stays separate — add/edit cards here without rewriting the screen.
 */

export type TrainingPageId =
	| 'welcome'
	| 'today'
	| 'sleep'
	| 'feeding'
	| 'diaper'
	| 'quick-events'
	| 'diary'
	| 'development'
	| 'moments'
	| 'health'
	| 'statistics'
	| 'reports'
	| 'reminders'
	| 'multi-child'
	| 'backup'
	| 'done'

export interface TrainingPage {
	id: TrainingPageId
	title: string
	body: string
	/** Short accent line under the body (optional). */
	callout?: string
	bullets?: string[]
	/** Accessibility / visual hint label (not shown as English enum). */
	iconLabel: string
	/** Optional deep link into the app. */
	openHref?: string
	openLabel?: string
}

/**
 * Ordered training cards: welcome → guides → done.
 */
export const TRAINING_PAGES: TrainingPage[] = [
	{
		id: 'welcome',
		title: 'Добро пожаловать в «Дневник малыша»',
		body:
			'Здесь можно быстро записывать сон, кормления, подгузники, развитие и важные события малыша. Большинство действий занимают всего пару касаний.',
		iconLabel: 'Приветствие',
	},
	{
		id: 'today',
		title: 'Сегодня',
		body:
			'Это главный экран. Здесь видно текущее состояние: сон или бодрствование, последние кормления и подгузники, а также быстрые действия.',
		callout: 'Большинство записей начинаются отсюда.',
		bullets: [
			'Текущий статус малыша',
			'Последние кормления и подгузники',
			'Кнопки быстрого добавления',
		],
		iconLabel: 'Сегодня',
	},
	{
		id: 'sleep',
		title: 'Сон и бодрствование',
		body:
			'Нажмите «Сон» — таймер начнётся сразу. Можно свернуть приложение: при возврате активный сон восстановится. Если забыли отметить вовремя, сон можно добавить или исправить позже.',
		callout: 'На экране также видно текущее время бодрствования.',
		iconLabel: 'Сон',
	},
	{
		id: 'feeding',
		title: 'Кормление',
		body:
			'Доступны грудь, бутылочка со смесью или сцеженным молоком, сцеживание, вода и прикорм. При грудном вскармливании можно переключать левую и правую сторону.',
		callout: 'Вода учитывается отдельно от молока и смеси.',
		iconLabel: 'Кормление',
	},
	{
		id: 'diaper',
		title: 'Подгузники',
		body:
			'Быстрый сценарий: Подгузник → Мокрый / Грязный / Оба / Сухой. Подробности при необходимости можно дополнить позже.',
		iconLabel: 'Подгузник',
	},
	{
		id: 'quick-events',
		title: 'Быстрые события',
		body:
			'Кнопка «Ещё» на главном экране открывает повседневные события: прогулка, купание, массаж, животик, витамин, температура, лекарство и своё событие.',
		callout: 'Можно создать свой тип, например «Бассейн».',
		iconLabel: 'События',
	},
	{
		id: 'diary',
		title: 'Дневник',
		body:
			'Вся история по дням: поиск, фильтры, выбор даты и правка задним числом.',
		callout: 'Практически любую ошибочную запись можно исправить позже.',
		iconLabel: 'Дневник',
	},
	{
		id: 'development',
		title: 'Развитие и измерения',
		body:
			'Здесь отмечают вес, рост, окружность головы, достижения и зубы — чтобы видеть динамику вашего малыша.',
		iconLabel: 'Развитие',
		openHref: '/(tabs)/development',
		openLabel: 'Открыть раздел',
	},
	{
		id: 'moments',
		title: 'Моменты и фотографии',
		body:
			'Можно сохранять фотографии и важные моменты, выбирать фото месяца. Данные остаются на устройстве и позже помогают собрать летопись первого года.',
		callout: 'Данные хранятся локально на устройстве.',
		iconLabel: 'Моменты',
	},
	{
		id: 'health',
		title: 'Здоровье',
		body:
			'Температура, симптомы, лекарства и витамины, визиты к врачу, фотографии и вложения — всё в одном разделе для ваших записей.',
		callout:
			'Приложение помогает вести записи, но не заменяет консультацию врача.',
		iconLabel: 'Здоровье',
		openHref: '/health',
		openLabel: 'Открыть здоровье',
	},
	{
		id: 'statistics',
		title: 'Статистика',
		body:
			'Смотрите сводки за 7, 30, 90 дней или за всё время: сон, бодрствование, кормления, подгузники, развитие и здоровье.',
		iconLabel: 'Статистика',
		openHref: '/(tabs)/stats',
		openLabel: 'Открыть статистику',
	},
	{
		id: 'reports',
		title: 'Отчёты и PDF',
		body:
			'Можно сформировать короткую текстовую сводку или PDF, выбрать нужные разделы и отправить через системное «Поделиться».',
		callout:
			'PDF можно подготовить перед визитом к врачу или отправить близким.',
		iconLabel: 'Отчёты',
		openHref: '/reports',
		openLabel: 'Открыть отчёты',
	},
	{
		id: 'reminders',
		title: 'Напоминания',
		body:
			'Напоминания создаёте только вы — по умолчанию приложение ничего не навязывает. Можно настроить витамин, лекарство, «Врач», кормление или своё событие.',
		callout: 'Уведомления локальные, на этом устройстве.',
		iconLabel: 'Напоминания',
		openHref: '/reminders',
		openLabel: 'Открыть напоминания',
	},
	{
		id: 'multi-child',
		title: 'Несколько детей',
		body:
			'На экране «Сегодня» можно быстро переключить активного ребёнка по имени. Данные каждого ребёнка хранятся отдельно — удобно и для близнецов.',
		iconLabel: 'Дети',
		openHref: '/children',
		openLabel: 'Мои дети',
	},
	{
		id: 'backup',
		title: 'Резервная копия',
		body:
			'Кнопки «Быстрая · без фотографий» и «Полная · с фотографиями»: быстрая сохраняет данные без медиа, полная включает фотографии и документы и из‑за этого может быть большой.',
		callout:
			'Резервная копия нужна для переноса дневника на другой телефон.',
		iconLabel: 'Копия',
		openHref: '/backup',
		openLabel: 'Открыть резервные копии',
	},
	{
		id: 'done',
		title: 'Всё готово',
		body:
			'Начните с главного экрана «Сегодня». Если что-то отметили не вовремя — запись почти всегда можно исправить позже.',
		iconLabel: 'Готово',
	},
]

export function getTrainingPageCount (): number {
	return TRAINING_PAGES.length
}

export function getTrainingPageAt (index: number): TrainingPage | null {
	if (index < 0 || index >= TRAINING_PAGES.length) {
		return null
	}
	return TRAINING_PAGES[index] ?? null
}

export function findTrainingPageIndex (id: TrainingPageId): number {
	return TRAINING_PAGES.findIndex((page) => page.id === id)
}
