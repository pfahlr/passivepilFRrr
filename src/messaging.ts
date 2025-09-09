import { defineExtensionMessaging } from '@webext-core/messaging';

export interface ProtocolMap {
  updateBadge(): void;
  nativePing(): { ok: boolean; error?: string };
  nativeAppend(data: { path: string; lines: string[] }): { ok: boolean; error?: string };
}

export const messaging = defineExtensionMessaging<ProtocolMap>();
