/**
 * SQLite serialization queue — Promise.all must not hit the DB in parallel.
 */

import {
	createSerializedExecutor,
	SqliteWriteQueue,
} from '../src/db/sqliteQueue'
import type { SqlExecutor, SqlParam } from '../src/db/types'

class CountingExecutor implements SqlExecutor {
	active = 0
	maxActive = 0
	calls = 0

	private async bump<T> (fn: () => Promise<T>): Promise<T> {
		this.calls += 1
		this.active += 1
		this.maxActive = Math.max(this.maxActive, this.active)
		try {
			// Simulate native async latency.
			await new Promise((resolve) => setTimeout(resolve, 5))
			return await fn()
		} finally {
			this.active -= 1
		}
	}

	runAsync (_sql: string, ..._params: SqlParam[]) {
		return this.bump(async () => ({ changes: 1, lastInsertRowId: 0 }))
	}

	getFirstAsync<T> (_sql: string, ..._params: SqlParam[]) {
		return this.bump(async () => null as T | null)
	}

	getAllAsync<T> (_sql: string, ..._params: SqlParam[]) {
		return this.bump(async () => [] as T[])
	}

	execAsync (_sql: string) {
		return this.bump(async () => undefined)
	}

	withTransactionAsync (task: () => Promise<void>) {
		return this.bump(async () => {
			await task()
		})
	}
}

describe('SqliteWriteQueue', () => {
	it('runs enqueued tasks sequentially', async () => {
		const queue = new SqliteWriteQueue()
		const order: number[] = []

		await Promise.all([
			queue.run(async () => {
				await new Promise((r) => setTimeout(r, 10))
				order.push(1)
			}),
			queue.run(async () => {
				order.push(2)
			}),
			queue.run(async () => {
				order.push(3)
			}),
		])

		expect(order).toEqual([1, 2, 3])
	})

	it('keeps going after a rejected task', async () => {
		const queue = new SqliteWriteQueue()
		const results: string[] = []

		await expect(
			queue.run(async () => {
				throw new Error('boom')
			}),
		).rejects.toThrow('boom')

		await queue.run(async () => {
			results.push('ok')
		})

		expect(results).toEqual(['ok'])
	})
})

describe('createSerializedExecutor', () => {
	it('prevents concurrent native-style calls under Promise.all', async () => {
		const inner = new CountingExecutor()
		const db = createSerializedExecutor(inner)

		await Promise.all([
			db.getAllAsync('SELECT 1'),
			db.getAllAsync('SELECT 2'),
			db.getAllAsync('SELECT 3'),
		])

		expect(inner.calls).toBe(3)
		expect(inner.maxActive).toBe(1)
	})
})
