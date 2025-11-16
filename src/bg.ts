// Types are defined inline to avoid import/export issues in Chrome extensions
type NostrMessageType = "REQ" | "EVENT" | "EOSE" | "NOTICE" | "CLOSE" | "AUTH" | "COUNT" | "OK";
interface TabState {
  attached: boolean;
  port: chrome.runtime.Port | null;
}

// Nostr message types we care about
const NOSTR_TYPES = new Set<NostrMessageType>(["REQ", "EVENT", "EOSE", "NOTICE", "CLOSE", "AUTH", "COUNT", "OK"]);

// Track debugger state per tab
const tabs = new Map<number, TabState>();

chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  const match = port.name.match(/^devtools-(\d+)$/);
  if (!match) return;
  
  const tabId = Number(match[1]);
  
  let state = tabs.get(tabId) || { attached: false, port: null };
  state.port = port;
  tabs.set(tabId, state);
  
  // Handle attach/detach requests
  port.onMessage.addListener(async (msg: any) => {
    console.log('[BG] Message received:', msg.type, 'Current state.attached:', state.attached);
    
    if (msg.type === "attach") {
      if (state.attached) {
        console.log('[BG] Already attached, ignoring');
        port.postMessage({ type: "status", attached: true });
        return;
      }
      
      try {
        console.log('[BG] Attaching debugger...');
        await chrome.debugger.attach({ tabId }, "1.3");
        await chrome.debugger.sendCommand({ tabId }, "Network.enable");
        state.attached = true;
        console.log('[BG] Attached successfully');
        port.postMessage({ type: "status", attached: true });
      } catch (err) {
        console.error('[BG] Attach failed:', err);
        port.postMessage({ 
          type: "status", 
          attached: false, 
          error: String(err) 
        });
      }
    } else if (msg.type === "detach") {
      if (!state.attached) {
        console.log('[BG] Already detached, ignoring');
        port.postMessage({ type: "status", attached: false });
        return;
      }
      
      try {
        console.log('[BG] Detaching debugger...');
        await chrome.debugger.detach({ tabId });
        state.attached = false;
        console.log('[BG] Detached successfully');
        port.postMessage({ type: "status", attached: false });
      } catch (err) {
        console.error('[BG] Detach error (ignoring):', err);
        state.attached = false;
        port.postMessage({ type: "status", attached: false });
      }
    }
  });
  
  // Cleanup on disconnect
  port.onDisconnect.addListener(() => {
    if (state.attached) {
      chrome.debugger.detach({ tabId }).catch(() => {});
    }
    tabs.delete(tabId);
  });
});

// Listen for WebSocket frames
chrome.debugger.onEvent.addListener((
  source: chrome.debugger.Debuggee,
  method: string,
  params?: any
) => {
  if (method !== "Network.webSocketFrameSent" && method !== "Network.webSocketFrameReceived") {
    return;
  }
  
  const state = tabs.get(source.tabId!);
  if (!state || !state.attached || !state.port) return;
  
  const data = params?.response?.payloadData;
  if (typeof data !== "string") return;
  
  // Try to parse as JSON array
  let frame: any;
  try {
    frame = JSON.parse(data);
  } catch {
    return;
  }
  
  // Check if it's a Nostr message
  if (!Array.isArray(frame) || !frame[0] || !NOSTR_TYPES.has(frame[0])) {
    return;
  }
  
  const direction = method.endsWith("Sent") ? "out" : "in";
  
  // Send to devtools panel
  state.port.postMessage({
    type: "nostr",
    dir: direction,
    frame: frame,
    timestamp: params.timestamp
  });
});

// Handle debugger detach events
chrome.debugger.onDetach.addListener((
  source: chrome.debugger.Debuggee,
  reason: string
) => {
  const state = tabs.get(source.tabId!);
  if (state) {
    state.attached = false;
    if (state.port) {
      state.port.postMessage({ 
        type: "status", 
        attached: false, 
        error: `Debugger detached: ${reason}` 
      });
    }
  }
});

