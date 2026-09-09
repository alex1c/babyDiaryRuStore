/**
 * Serializes async work against a single SQLite native database.
 *
 * expo-sqlite@57 has real Android failures when multiple queries hit the same
 * NativeDatabase concurrently via Promise.all. Always route repository calls
 * through this queue (or call them sequentially).
 */

export type AsyncTask<T> = () => Promise<T>

/**
 * FIFO promise chain. Each task starts only after the previous settles
 * (success or failure), so callers can safely fan-out with Promise.all
 * at the service layer without parallel native queries.
 */
export class SqliteWriteQueue {
	private chain: Promise<unknown> = Promise.resolve()

	/**
	 * Enqueue a task. Returned promise resolves/rejects with the task result.
	 * Failures do not break the queue for subsequent tasks.
	 */
	run<T> (task: AsyncTask<T>): Promise<T> {
		const next = this.chain.then(task, task)
		// Keep the chain alive even when the task rejects.
		this.chain = next.then(
			() => undefined,
			() => undefined,
		)
		return next
	}
}

/** Wrap any SqlExecutor so every method is serialized through one queue. */
export function createSerializedExecutor (
	inner: import('./types').SqlExecutor,
	queue: SqliteWriteQueue = new SqliteWriteQueue(),
): import('./types').SqlExecutor {
	return {
		runAsync: (sql, ...params) =>
			queue.run(() => inner.runAsync(sql, ...params)),
		getFirstAsync: <T>(sql: string, ...params: import('./types').SqlParam[]) =>
			queue.run(() => inner.getFirstAsync<T>(sql, ...params)),
		getAllAsync: <T>(sql: string, ...params: import('./types').SqlParam[]) =>
			queue.run(() => inner.getAllAsync<T>(sql, ...params)),
		execAsync: (sql) => queue.run(() => inner.execAsync(sql)),
		withTransactionAsync: (task) =>
			queue.run(() => inner.withTransactionAsync(task)),
	}
}
