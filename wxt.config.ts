import { defineConfig } from 'wxt';

export default defineConfig({
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
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
  },
});
