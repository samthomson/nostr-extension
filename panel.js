"use strict";
// Get the tab ID from chrome.devtools API
const tabId = chrome.devtools.inspectedWindow.tabId;
// Connect directly to background
const port = chrome.runtime.connect({ name: `devtools-${tabId}` });
// Handle messages from background
port.onMessage.addListener((msg) => {
    if (msg.type === "nostr") {
        // Add to central store
        store.addEvent(msg);
        // Update stream UI
        streamUI.addRow(msg);
    }
});
// Auto-attach on load
port.postMessage({ type: "attach" });
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
    });
});
