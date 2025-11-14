// Message types for communication between components
export type NostrMessageType = "REQ" | "EVENT" | "EOSE" | "NOTICE" | "CLOSE" | "AUTH" | "COUNT" | "OK";

export interface NostrEvent {
  kind?: number;
  pubkey?: string;
  content?: string;
  tags?: string[][];
  created_at?: number;
  id?: string;
  sig?: string;
}

export interface NostrFilter {
  kinds?: number[];
  authors?: string[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: any;
}

export type NostrFrame = [NostrMessageType, ...any[]];

export interface StatusMessage {
  type: "status";
  ok: boolean;
  error?: string;
}

export interface NostrMessage {
  type: "nostr";
  dir: "in" | "out";
  frame: NostrFrame;
  timestamp?: number;
}

export interface AttachMessage {
  type: "attach";
}

export type BackgroundMessage = StatusMessage | NostrMessage;
export type PanelMessage = AttachMessage;

export interface TabState {
  attached: boolean;
  port: chrome.runtime.Port | null;
}

export interface KindNames {
  [kind: number]: string;
}

