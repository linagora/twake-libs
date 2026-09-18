import type { Config } from 'jest'

// Set timezone to UTC for consistent test results across all environments
process.env.TZ = 'UTC'

const config: Config = {
  collectCoverage: false,
  coverageDirectory: 'coverage',
  passWithNoTests: true,
  clearMocks: true,
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  }
}

export default config
