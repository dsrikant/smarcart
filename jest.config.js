module.exports = {
  watchman: false,
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: false,
        presets: [
          '@babel/preset-typescript',
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
        plugins: [
          '@babel/plugin-transform-modules-commonjs',
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          '@babel/plugin-transform-class-properties',
        ],
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!@nozbe/watermelondb)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
