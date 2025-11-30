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

// Track WebSocket connections by requestId to get relay URLs
const websocketConnections = new Map<string, string>(); // requestId -> URL

chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  const match = port.name.match(/^devtools-(\d+)$/);
  if (!match) {
    console.warn('[BG] Invalid port name:', port.name);
    return;
  }
  
  const tabId = Number(match[1]);
  
  let state = tabs.get(tabId) || { attached: false, port: null };
  state.port = port;
  tabs.set(tabId, state);
  
  setupPortHandlers(port, tabId, state);
});

function setupPortHandlers(port: chrome.runtime.Port, tabId: number, state: TabState) {
  
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
}

// Listen for WebSocket events
chrome.debugger.onEvent.addListener((
  source: chrome.debugger.Debuggee,
  method: string,
  params?: any
) => {
  const state = tabs.get(source.tabId!);
  if (!state || !state.attached || !state.port) return;
  
  // Track WebSocket connections to get relay URLs
  if (method === "Network.webSocketWillSendHandshakeRequest") {
    const requestId = params.requestId;
    const url = params.request?.url;
    if (requestId && url) {
      websocketConnections.set(requestId, url);
      console.log('[BG] Tracked WebSocket connection:', requestId, url);
    }
    return;
  }
  
  // Also track when WebSocket is created (alternative event)
  if (method === "Network.webSocketCreated") {
    const requestId = params.requestId;
    const url = params.url;
    if (requestId && url) {
      websocketConnections.set(requestId, url);
      console.log('[BG] Tracked WebSocket created:', requestId, url);
    }
    return;
  }
  
  // Handle WebSocket frames
  if (method !== "Network.webSocketFrameSent" && method !== "Network.webSocketFrameReceived") {
    return;
  }
  
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
  
  // Get relay URL from requestId - check multiple possible locations
  const requestId = params.requestId || params.request?.requestId;
  
  // Debug logging
  if (!requestId) {
    console.log('[BG] No requestId in params:', method, params);
  }
  
  const relayUrl = requestId ? websocketConnections.get(requestId) : null;
  
  if (!relayUrl) {
    if (requestId) {
      console.log('[BG] No relay URL found for requestId:', requestId, 'Available connections:', Array.from(websocketConnections.keys()));
    } else {
      console.log('[BG] No requestId available, params keys:', Object.keys(params || {}));
    }
  }
  
  // Extract just the hostname for display
  let relay = "";
  if (relayUrl) {
    try {
      const url = new URL(relayUrl);
      relay = url.hostname;
    } catch {
      relay = relayUrl;
    }
  }
  
  // Send to devtools panel
  state.port.postMessage({
    type: "nostr",
    dir: direction,
    frame: frame,
    timestamp: params.timestamp,
    relay: relay
  });
});

// Handle debugger detach events
chrome.debugger.onDetach.addListener((
  source: chrome.debugger.Debuggee,
  reason: string
) => {
  console.log('[BG] onDetach fired, reason:', reason);
  const state = tabs.get(source.tabId!);
  if (state) {
    state.attached = false;
    console.log('[BG] State set to detached');
    if (state.port) {
      // Don't send error for user-initiated detach
      state.port.postMessage({ 
        type: "status", 
        attached: false
      });
    }
  }
});

