import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['eval/**/*.test.ts', 'lib/**/*.test.ts'], environment: 'node' },
});
