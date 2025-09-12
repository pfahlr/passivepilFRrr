import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  alias: {
    '~': 'src',
    '#imports': '.wxt/imports',
  },
  imports: {
    eslintrc: {
      enabled: true,
    },
  },
  manifest: {
    permissions: ['storage', 'scripting', 'activeTab', 'nativeMessaging'],
    optional_permissions: ['downloads'],
    host_permissions: ['<all_urls>'],
  },
});
