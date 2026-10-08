import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/html-self-closing': ['error', { html: { void: 'always', normal: 'always' } }],
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
);
