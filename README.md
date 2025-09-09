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

# passivepilFRrr
