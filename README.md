# WXT + Svelte

This template should help get you started developing with Svelte in WXT.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## Native Host Setup

This project communicates with a Python native messaging host. To install it:

1. Make the script executable:
   ```bash
   chmod +x native_host/selector_logger.py

   ```
2. Copy `native_host/com.pfahlr.selectorlogger.json` to your browser's native-messaging hosts directory and update the `path` if needed.

  The manifest now references `selector_logger.py` by relative path so the host can be installed in any location.

  The manifest references `../selector_logger.py` so the host can be installed alongside this repository in any location.

## Puppeteer Setup

This project uses [Puppeteer](https://pptr.dev/) for end-to-end tests. Chromium requires several system libraries to run. On Debian/Ubuntu, install them with:

```bash
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

After installing the libraries, download the Chromium binary used by Puppeteer:

```bash
pnpm exec puppeteer browsers install
```

