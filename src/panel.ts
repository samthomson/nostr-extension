// Get the tab ID from chrome.devtools API
const tabId = chrome.devtools.inspectedWindow.tabId;

// Connect directly to background
const port = chrome.runtime.connect({ name: `devtools-${tabId}` });

// Track inspection state
let isInspecting = false;

// UI elements
const toggleBtn = document.getElementById('toggleInspectionBtn') as HTMLButtonElement;
const statusSpan = document.getElementById('inspectionStatus') as HTMLSpanElement;
const contentWrapper = document.getElementById('contentWrapper') as HTMLDivElement;

// Update UI based on inspection state
function updateInspectionUI(inspecting: boolean): void {
  isInspecting = inspecting;
  
  if (inspecting) {
    toggleBtn.textContent = 'Stop Inspecting';
    toggleBtn.classList.add('inspecting');
    statusSpan.textContent = '🟢 Inspecting WebSocket traffic';
    statusSpan.classList.add('active');
    contentWrapper.classList.remove('disabled');
  } else {
    toggleBtn.textContent = 'Start Inspecting';
    toggleBtn.classList.remove('inspecting');
    statusSpan.textContent = 'Not inspecting';
    statusSpan.classList.remove('active');
    contentWrapper.classList.add('disabled');
  }
}

// Handle toggle button click
toggleBtn.addEventListener('click', () => {
  if (isInspecting) {
    // Optimistically update UI immediately for better UX
    updateInspectionUI(false);
    port.postMessage({ type: "detach" });
  } else {
    // For attach, wait for confirmation since it can fail
    port.postMessage({ type: "attach" });
  }
});

// Handle messages from background
port.onMessage.addListener((msg: any) => {
  if (msg.type === "nostr") {
    // Add to central store
    store.addEvent(msg);
    // Update stream UI
    streamUI.addRow(msg);
  } else if (msg.type === "status") {
    console.log('[Panel] Status received:', msg);
    // Always sync UI with actual state from background
    updateInspectionUI(msg.attached);
    
    if (msg.error && msg.attached === false) {
      // Only log detach "errors" (which are just reasons), not actual errors
      console.log('Debugger detached:', msg.error);
    } else if (msg.error) {
      console.error('Inspection error:', msg.error);
    }
  }
});

// Initialize UI
updateInspectionUI(false);

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = (tab as HTMLElement).dataset.tab!;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update active content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(targetTab)!.classList.add('active');
    
    // Render tab content if needed
    if (targetTab === 'summary') {
      summaryUI.render();
    }
  });
});



