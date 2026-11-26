import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Lets @testing-library/react unmount what a test rendered after it
    globals: true,
    server: {
      deps: {
        // Their ESM builds import without extensions: let vite resolve them
        inline: [/@linagora\/twake-mui/, /@linagora\/twake-icons/]
      }
    }
  }
})
