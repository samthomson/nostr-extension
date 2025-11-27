"use strict";
// Get the tab ID - try chrome.devtools.inspectedWindow.tabId first (works in Brave)
// If not available (Chrome), use a fallback method
let tabId = null;
let port = null;
// Try to get tabId directly (works in Brave, not in Chrome)
try {
    // @ts-ignore - tabId may not be in TypeScript definitions but exists in Brave
    if (chrome.devtools && chrome.devtools.inspectedWindow && chrome.devtools.inspectedWindow.tabId !== undefined) {
        // @ts-ignore
        tabId = chrome.devtools.inspectedWindow.tabId;
    }
}
catch (e) {
    // Ignore
}
if (tabId !== null) {
    // We have tabId, connect directly
    port = chrome.runtime.connect({ name: `devtools-${tabId}` });
    setupMessageHandlers();
}
else {
    // Chrome fallback: connect with generic name and let background identify the tab
    port = chrome.runtime.connect({ name: "devtools-panel" });
    setupMessageHandlers();
    // Also try to get tabId via message (background will try to identify it)
    chrome.runtime.sendMessage({ type: "getTabId" }, (response) => {
        if (response && response.tabId) {
            tabId = response.tabId;
            // Reconnect with proper name for better tracking
            const oldPort = port;
            port = chrome.runtime.connect({ name: `devtools-${tabId}` });
            setupMessageHandlers();
            // Forward any pending messages if needed
            oldPort?.disconnect();
        }
    });
}
// Track inspection state
let isInspecting = false;
// UI elements
const toggleBtn = document.getElementById('toggleInspectionBtn');
const statusSpan = document.getElementById('inspectionStatus');
const contentWrapper = document.getElementById('contentWrapper');
// Update UI based on inspection state
function updateInspectionUI(inspecting) {
    isInspecting = inspecting;
    if (inspecting) {
        toggleBtn.textContent = 'Stop Inspecting';
        toggleBtn.classList.add('inspecting');
        statusSpan.textContent = '🟢 Inspecting WebSocket traffic';
        statusSpan.classList.add('active');
        contentWrapper.classList.remove('disabled');
    }
    else {
        toggleBtn.textContent = 'Start Inspecting';
        toggleBtn.classList.remove('inspecting');
        statusSpan.textContent = 'Not inspecting';
        statusSpan.classList.remove('active');
        contentWrapper.classList.add('disabled');
    }
}
// Handle toggle button click
toggleBtn.addEventListener('click', () => {
    if (!port) {
        console.error('[Panel] Port not ready yet');
        return;
    }
    if (isInspecting) {
        // Optimistically update UI immediately for better UX
        updateInspectionUI(false);
        port.postMessage({ type: "detach" });
    }
    else {
        // For attach, wait for confirmation since it can fail
        port.postMessage({ type: "attach" });
    }
});
function setupMessageHandlers() {
    if (!port)
        return;
    // Handle messages from background
    port.onMessage.addListener((msg) => {
        if (msg.type === "nostr") {
            // Add to central store
            store.addEvent(msg);
            // Update stream UI
            streamUI.addRow(msg);
        }
        else if (msg.type === "status") {
            console.log('[Panel] Status received:', msg);
            // Always sync UI with actual state from background
            updateInspectionUI(msg.attached);
            if (msg.error && msg.attached === false) {
                // Only log detach "errors" (which are just reasons), not actual errors
                console.log('Debugger detached:', msg.error);
            }
            else if (msg.error) {
                console.error('Inspection error:', msg.error);
            }
        }
    });
}
// Initialize UI
updateInspectionUI(false);
// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        // Update active content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(targetTab).classList.add('active');
        // Render tab content if needed
        if (targetTab === 'summary') {
            summaryUI.render();
        }
        else if (targetTab === 'build') {
            buildUI.render();
        }
    });
});
