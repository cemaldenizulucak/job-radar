const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'scripts/*'],
  },
  {
    rules: {
      // Fetch-on-mount hooks set loading/error state; screens also refetch on focus.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
