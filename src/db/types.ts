/**
 * Minimal SQL executor interface so repositories can be tested
 * against either expo-sqlite or an in-memory fake.
 */

export type SqlParam = string | number | null

export interface SqlRunResult {
	changes: number
	lastInsertRowId: number
}

export interface SqlExecutor {
	runAsync (sql: string, ...params: SqlParam[]): Promise<SqlRunResult>
	getFirstAsync<T> (sql: string, ...params: SqlParam[]): Promise<T | null>
	getAllAsync<T> (sql: string, ...params: SqlParam[]): Promise<T[]>
	execAsync (sql: string): Promise<void>
	withTransactionAsync (task: (transactionDb: SqlExecutor) => Promise<void>): Promise<void>
}
