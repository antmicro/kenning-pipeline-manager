module.exports = {
  env: {
    browser: true,
    es2022: true,
  },
  extends: [
    'plugin:vue/vue3-essential',
    'airbnb-base',
  ],
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    'vue',
  ],
  rules: {
    indent: ["error", 4],
    "import/no-extraneous-dependencies": 0,
  },
};
