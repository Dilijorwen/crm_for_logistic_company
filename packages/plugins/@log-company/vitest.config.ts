export default {
  root: '.',
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        esModuleInterop: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        target: 'ES2021',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['*/src/**/__tests__/**/*.test.ts', '__tests__/**/*.test.ts'],
  },
};
