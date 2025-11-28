"use strict";
// Nostr message types we care about
const NOSTR_TYPES = new Set(["REQ", "EVENT", "EOSE", "NOTICE", "CLOSE", "AUTH", "COUNT", "OK"]);
// Track debugger state per tab
const tabs = new Map();
// Track WebSocket connections by requestId to get relay URLs
const websocketConnections = new Map(); // requestId -> URL
// Handle messages (for getTabId request)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "getTabId") {
        // Find the tab that has devtools open
        // We can't directly know which tab, but we can use a heuristic:
        // Get all tabs and find one that might have devtools
        // Actually, a better approach: use chrome.tabs.query to get the active tab
        // But devtools panels don't have a direct way to identify their tab
        // So we'll use a different approach: track connections and match them
        // For now, try to get the tab from the sender if available
        if (sender.tab && sender.tab.id !== undefined) {
            sendResponse({ tabId: sender.tab.id });
            return true;
        }
        // Fallback: query for active tab (not perfect but better than nothing)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id !== undefined) {
                sendResponse({ tabId: tabs[0].id });
            }
            else {
                sendResponse({ error: "Could not determine tab ID" });
            }
        });
        return true; // Keep channel open for async response
    }
});
chrome.runtime.onConnect.addListener((port) => {
    const match = port.name.match(/^devtools-(\d+)$/);
    if (!match) {
        // Handle connection without tab ID - try to identify the tab
        if (port.name === "devtools-panel" || port.name.startsWith("devtools-")) {
            // Try to find the tab by querying
            chrome.tabs.query({ active: true, currentWindow: true }, (queryTabs) => {
                if (queryTabs.length > 0 && queryTabs[0].id !== undefined) {
                    const tabId = queryTabs[0].id;
                    let state = tabs.get(tabId) || { attached: false, port: null };
                    state.port = port;
                    tabs.set(tabId, state);
                    setupPortHandlers(port, tabId, state);
                }
            });
        }
        return;
    }
    const tabId = Number(match[1]);
    let state = tabs.get(tabId) || { attached: false, port: null };
    state.port = port;
    tabs.set(tabId, state);
    setupPortHandlers(port, tabId, state);
});
function setupPortHandlers(port, tabId, state) {
    // Handle attach/detach requests
    port.onMessage.addListener(async (msg) => {
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
            }
            catch (err) {
                console.error('[BG] Attach failed:', err);
                port.postMessage({
                    type: "status",
                    attached: false,
                    error: String(err)
                });
            }
        }
        else if (msg.type === "detach") {
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
            }
            catch (err) {
                console.error('[BG] Detach error (ignoring):', err);
                state.attached = false;
                port.postMessage({ type: "status", attached: false });
            }
        }
    });
    // Cleanup on disconnect
    port.onDisconnect.addListener(() => {
        if (state.attached) {
            chrome.debugger.detach({ tabId }).catch(() => { });
        }
        tabs.delete(tabId);
    });
}
// Listen for WebSocket events
chrome.debugger.onEvent.addListener((source, method, params) => {
    const state = tabs.get(source.tabId);
    if (!state || !state.attached || !state.port)
        return;
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
    if (typeof data !== "string")
        return;
    // Try to parse as JSON array
    let frame;
    try {
        frame = JSON.parse(data);
    }
    catch {
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
        }
        else {
            console.log('[BG] No requestId available, params keys:', Object.keys(params || {}));
        }
    }
    // Extract just the hostname for display
    let relay = "";
    if (relayUrl) {
        try {
            const url = new URL(relayUrl);
            relay = url.hostname;
        }
        catch {
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
chrome.debugger.onDetach.addListener((source, reason) => {
    console.log('[BG] onDetach fired, reason:', reason);
    const state = tabs.get(source.tabId);
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
