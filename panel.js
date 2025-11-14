console.log("[panel] Starting...");

const counts = new Map();
const statusEl = document.getElementById("status");
const countsEl = document.getElementById("counts");
const rowsEl = document.getElementById("rows");

// Get the tab ID from chrome.devtools API
const tabId = chrome.devtools.inspectedWindow.tabId;
console.log("[panel] Tab ID:", tabId);

// Connect directly to background
const port = chrome.runtime.connect({ name: `devtools-${tabId}` });
console.log("[panel] Connected to background");

// Handle messages from background
port.onMessage.addListener((msg) => {
  console.log("[panel] Received message:", msg);
  
  if (msg.type === "status") {
    if (msg.ok) {
      statusEl.textContent = "✓ Listening";
      statusEl.className = "attached";
    } else {
      statusEl.textContent = "✗ Error: " + (msg.error || "Unknown");
      statusEl.className = "error";
    }
  }
  
  if (msg.type === "nostr") {
    addRow(msg);
    updateCounts(msg.frame[0]);
  }
});

port.onDisconnect.addListener(() => {
  console.log("[panel] Disconnected from background");
  statusEl.textContent = "Disconnected";
  statusEl.className = "error";
});

// Auto-attach on load
console.log("[panel] Requesting attach...");
port.postMessage({ type: "attach" });

function updateCounts(type) {
  counts.set(type, (counts.get(type) || 0) + 1);
  const parts = [];
  for (const [k, v] of counts.entries()) {
    parts.push(`${k}: ${v}`);
  }
  countsEl.textContent = parts.join("  •  ");
}

// Common Nostr kind descriptions
const KIND_NAMES = {
  0: "Profile",
  1: "Text Note",
  2: "Relay Rec",
  3: "Contacts",
  4: "DM",
  5: "Delete",
  6: "Repost",
  7: "Reaction",
  40: "Channel",
  41: "Chan Meta",
  42: "Chan Msg",
  43: "Chan Hide",
  44: "Chan Mute",
  1984: "Report",
  9734: "Zap Req",
  9735: "Zap",
  10000: "Mute List",
  10001: "Pin List",
  10002: "Relay List",
  22242: "Client Auth",
  23194: "Wallet Info",
  23195: "Wallet Req",
  24133: "Nostr Connect",
  27235: "HTTP Auth",
  30000: "People List",
  30001: "Bookmarks",
  30008: "Profile Badges",
  30009: "Badge Def",
  30017: "Stall",
  30018: "Product",
  30023: "Long-form",
  30024: "Draft Long-form",
  30078: "App Data",
  30311: "Live Event",
  30315: "Status",
  30402: "Classified",
  30403: "Draft Classified"
};

function getKindName(kind) {
  if (!kind) return "";
  return KIND_NAMES[kind] || "";
}

function addRow({dir, frame}) {
  const type = frame[0];
  let kind = "";
  let pubkey = "";
  
  if (type === "EVENT") {
    const evt = frame[1]?.kind !== undefined ? frame[1] : frame[2];
    if (evt) {
      kind = evt.kind ?? "";
      pubkey = evt.pubkey ? evt.pubkey.substring(0, 16) + "..." : "";
    }
  } else if (type === "REQ") {
    const filters = frame.slice(2);
    for (const f of filters) {
      if (f?.kinds?.length > 0) {
        kind = f.kinds[0];
        break;
      }
    }
  }
  
  const tr = document.createElement("tr");
  const preview = JSON.stringify(frame).substring(0, 100);
  const kindName = getKindName(kind);
  const kindDisplay = kind ? `${kind}${kindName ? ` (${kindName})` : ""}` : "";
  
  tr.innerHTML = `
    <td class="dir dir-${dir}">${dir === "in" ? "←" : "→"}</td>
    <td class="type">${escapeHtml(type)}</td>
    <td class="kind" title="${kindName}">${escapeHtml(kindDisplay)}</td>
    <td class="pubkey">${escapeHtml(pubkey)}</td>
    <td class="preview">${escapeHtml(preview)}${preview.length >= 100 ? "..." : ""}</td>
  `;
  
  rowsEl.insertBefore(tr, rowsEl.firstChild);
  
  if (rowsEl.children.length > 500) {
    rowsEl.removeChild(rowsEl.lastChild);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById("clear").addEventListener("click", () => {
  rowsEl.innerHTML = "";
  counts.clear();
  countsEl.textContent = "";
});

console.log("[panel] Ready");

