"use strict";
// Nostr message types we care about
const NOSTR_TYPES = new Set(["REQ", "EVENT", "EOSE", "NOTICE", "CLOSE", "AUTH", "COUNT", "OK"]);
// Track debugger state per tab
const tabs = new Map();
chrome.runtime.onConnect.addListener((port) => {
    const match = port.name.match(/^devtools-(\d+)$/);
    if (!match)
        return;
    const tabId = Number(match[1]);
    let state = tabs.get(tabId) || { attached: false, port: null };
    state.port = port;
    tabs.set(tabId, state);
    // Handle attach requests
    port.onMessage.addListener(async (msg) => {
        if (msg.type === "attach" && !state.attached) {
            try {
                await chrome.debugger.attach({ tabId }, "1.3");
                await chrome.debugger.sendCommand({ tabId }, "Network.enable");
                state.attached = true;
                port.postMessage({ type: "status", ok: true });
            }
            catch (err) {
                port.postMessage({
                    type: "status",
                    ok: false,
                    error: String(err)
                });
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
});
// Listen for WebSocket frames
chrome.debugger.onEvent.addListener((source, method, params) => {
    if (method !== "Network.webSocketFrameSent" && method !== "Network.webSocketFrameReceived") {
        return;
    }
    const state = tabs.get(source.tabId);
    if (!state || !state.attached || !state.port)
        return;
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
    // Send to devtools panel
    state.port.postMessage({
        type: "nostr",
        dir: direction,
        frame: frame,
        timestamp: params.timestamp
    });
});
// Handle debugger detach events
chrome.debugger.onDetach.addListener((source, reason) => {
    const state = tabs.get(source.tabId);
    if (state) {
        state.attached = false;
        if (state.port) {
            state.port.postMessage({
                type: "status",
                ok: false,
                error: `Debugger detached: ${reason}`
            });
        }
    }
});
