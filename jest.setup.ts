/**
 * Jest setup: mock native modules touched by repositories in Node.
 */

let mockUuidCounter = 0

jest.mock('expo-crypto', () => ({
	randomUUID: () => {
		mockUuidCounter += 1
		const hex = mockUuidCounter.toString(16).padStart(12, '0')
		return `00000000-0000-4000-8000-${hex}`
	},
}))

beforeEach(() => {
	mockUuidCounter = 0
})
