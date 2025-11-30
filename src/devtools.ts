// Create the panel and pass the tabId via URL parameter
const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
chrome.devtools.panels.create("Nostr", "", `panel.html?tabId=${inspectedTabId}`);

