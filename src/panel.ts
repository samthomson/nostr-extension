// Get tabId from URL parameter (passed from devtools.ts)
const urlParams = new URLSearchParams(window.location.search);
const tabId = parseInt(urlParams.get('tabId') || '', 10);

if (!tabId || isNaN(tabId)) {
  console.error('[Panel] No valid tabId found in URL');
}

// Connect to background script
const port = chrome.runtime.connect({ name: `devtools-${tabId}` });

// Set up message handlers immediately
port.onMessage.addListener((msg: any) => {
  if (msg.type === "nostr") {
    store.addEvent(msg);
    streamUI.addRow(msg);
  } else if (msg.type === "status") {
    console.log('[Panel] Status received:', msg);
    updateInspectionUI(msg.attached);
    if (msg.error) {
      console.log('Debugger status:', msg.error);
    }
  }
});

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
  if (!port) {
    console.error('[Panel] Port not ready yet');
    return;
  }
  
  if (isInspecting) {
    // Optimistically update UI immediately for better UX
    updateInspectionUI(false);
    port.postMessage({ type: "detach" });
  } else {
    // For attach, wait for confirmation since it can fail
    port.postMessage({ type: "attach" });
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
    } else if (targetTab === 'build') {
      buildUI.render();
    }
  });
});



