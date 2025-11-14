"use strict";
// UI for the Event Stream tab
// Common Nostr event kind descriptions
const KIND_NAMES = {
    0: "Profile",
    1: "Text Note",
    2: "Relay Rec",
    3: "Contacts",
    4: "Encrypted DM",
    5: "Event Delete",
    6: "Repost",
    7: "Reaction",
    8: "Badge Award",
    16: "Generic Repost",
    40: "Channel Create",
    41: "Channel Metadata",
    42: "Channel Message",
    43: "Channel Hide",
    44: "Channel Mute",
    1063: "File Metadata",
    1311: "Live Chat",
    1040: "OpenTimestamps",
    1984: "Reporting",
    1985: "Label",
    4550: "Community Post Approval",
    5000: "DM Relays",
    5999: "DM Relays",
    6000: "Repost (Kind 6000-6999)",
    7000: "Job Request",
    7001: "Job Result",
    9041: "Zap Goal",
    9734: "Zap Request",
    9735: "Zap Receipt",
    9802: "Highlights",
    10000: "Mute List",
    10001: "Pin List",
    10002: "Relay List",
    10003: "Bookmarks",
    10004: "Communities",
    10005: "Public Chats",
    10006: "Blocked Relays",
    10007: "Search Relays",
    10009: "User Groups",
    10015: "Interests",
    10030: "User Emoji",
    10050: "DM Relay List",
    10096: "File Storage",
    13194: "Wallet Info",
    21000: "Lightning Pub RPC",
    22242: "Client Auth",
    23194: "Wallet Info",
    23195: "Wallet Request",
    24133: "Nostr Connect",
    27235: "HTTP Auth",
    30000: "Follow Sets",
    30001: "Generic Lists",
    30002: "Relay Sets",
    30003: "Bookmark Sets",
    30004: "Curation Sets",
    30005: "Video Sets",
    30007: "Video View",
    30008: "Profile Badges",
    30009: "Badge Definition",
    30015: "Interest Sets",
    30017: "Stall",
    30018: "Product",
    30019: "Marketplace",
    30020: "Product Sold",
    30023: "Long-form",
    30024: "Draft Long-form",
    30030: "Emoji Sets",
    30063: "Release Artifact Sets",
    30078: "App Data",
    30311: "Live Event",
    30315: "User Status",
    30388: "Slide Set",
    30402: "Classified Listing",
    30403: "Draft Classified",
    30617: "Repository",
    30618: "Repository State",
    30818: "Wiki Article",
    30819: "Wiki Redirect",
    31922: "Date-Based Calendar",
    31923: "Time-Based Calendar",
    31924: "Calendar",
    31925: "Calendar RSVP",
    31989: "Handler Rec",
    31990: "Handler Info",
    34235: "Video Event",
    34236: "Short Video"
};
function getKindName(kind) {
    if (!kind)
        return "";
    const kindNum = typeof kind === "string" ? parseInt(kind, 10) : kind;
    return KIND_NAMES[kindNum] || "";
}
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function showCopyFeedback(iconEl) {
    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.textContent = 'Copied!';
    const rect = iconEl.getBoundingClientRect();
    feedback.style.left = rect.left + 'px';
    feedback.style.top = (rect.top - 25) + 'px';
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1000);
}
class StreamUI {
    constructor() {
        this.expandEvents = false;
        this.rowsEl = document.getElementById("rows");
        this.pauseBtn = document.getElementById("pauseBtn");
        this.clearBtn = document.getElementById("clearBtn");
        this.expandCheckbox = document.getElementById("expandEventsCheckbox");
        this.statElements = {
            total: document.getElementById("stat-total"),
            ws: document.getElementById("stat-ws"),
            nostr: document.getElementById("stat-nostr"),
            subsOpened: document.getElementById("stat-subs-opened"),
            subsClosed: document.getElementById("stat-subs-closed"),
            subsOpen: document.getElementById("stat-subs-open"),
            kinds: document.getElementById("stat-kinds")
        };
        this.setupControls();
        this.updateStats();
        // Subscribe to store changes to update stats
        store.subscribe(() => this.updateStats());
    }
    setupControls() {
        // Pause button
        this.pauseBtn.addEventListener("click", () => {
            const isPaused = store.isPaused();
            store.setPaused(!isPaused);
            this.updatePauseButton();
        });
        // Clear button
        this.clearBtn.addEventListener("click", () => {
            this.clear();
            store.clear();
        });
        // Expand checkbox
        this.expandCheckbox.addEventListener("change", () => {
            this.expandEvents = this.expandCheckbox.checked;
            this.reRenderAllRows();
        });
    }
    reRenderAllRows() {
        // Get all current events from store
        const allEvents = store.getAllEvents();
        // Clear the table
        this.rowsEl.innerHTML = "";
        // Re-render all events with new expand setting
        // Reverse to maintain newest-first order
        for (let i = allEvents.length - 1; i >= 0; i--) {
            this.renderRow(allEvents[i]);
        }
    }
    updatePauseButton() {
        const isPaused = store.isPaused();
        if (isPaused) {
            this.pauseBtn.textContent = "Resume";
            this.pauseBtn.classList.add("paused");
        }
        else {
            this.pauseBtn.textContent = "Pause";
            this.pauseBtn.classList.remove("paused");
        }
    }
    updateStats() {
        const stats = store.getStats();
        this.statElements.total.textContent = stats.total.toLocaleString();
        this.statElements.ws.textContent = stats.wsEvents.toLocaleString();
        this.statElements.nostr.textContent = stats.nostrEvents.toLocaleString();
        this.statElements.subsOpened.textContent = stats.subsOpened.toLocaleString();
        this.statElements.subsClosed.textContent = stats.subsClosed.toLocaleString();
        this.statElements.subsOpen.textContent = stats.subsOpen.toLocaleString();
        this.statElements.kinds.textContent = stats.uniqueKinds.toLocaleString();
    }
    addRow(msg) {
        // Don't add rows if paused
        if (store.isPaused())
            return;
        this.renderRow(msg);
    }
    renderRow(msg) {
        const { dir, frame } = msg;
        const type = frame[0];
        let kind = "";
        let pubkey = "";
        let fullPubkey = "";
        if (type === "EVENT") {
            const evt = frame[1]?.kind !== undefined ? frame[1] : frame[2];
            if (evt) {
                kind = evt.kind ?? "";
                fullPubkey = evt.pubkey || "";
                pubkey = fullPubkey ? fullPubkey.substring(0, 16) + "..." : "";
            }
        }
        else if (type === "REQ") {
            const filters = frame.slice(2);
            for (const f of filters) {
                if (f?.kinds?.length && f.kinds.length > 0) {
                    kind = f.kinds[0];
                    break;
                }
            }
        }
        const tr = document.createElement("tr");
        const kindName = getKindName(kind);
        const kindTooltip = kind && kindName ? `${kind} - ${kindName}` : (kind ? String(kind) : "");
        // Determine what to show in preview
        let previewContent = "";
        let fullPreviewContent = "";
        let previewClass = this.expandEvents ? "preview-expanded" : "preview-compact";
        if (type === "EVENT") {
            // Show the event object, not the whole frame
            const evt = frame[1]?.kind !== undefined ? frame[1] : frame[2];
            fullPreviewContent = JSON.stringify(evt, null, 2);
            if (this.expandEvents) {
                previewContent = fullPreviewContent;
            }
            else {
                previewContent = JSON.stringify(evt).substring(0, 100);
                if (JSON.stringify(evt).length > 100)
                    previewContent += "...";
            }
        }
        else {
            // For non-EVENT messages, show the frame
            fullPreviewContent = JSON.stringify(frame, null, 2);
            if (this.expandEvents) {
                previewContent = fullPreviewContent;
            }
            else {
                previewContent = JSON.stringify(frame).substring(0, 100);
                if (JSON.stringify(frame).length > 100)
                    previewContent += "...";
            }
        }
        // Copy icon SVG
        const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        // Pubkey cell with copy functionality
        const pubkeyHtml = fullPubkey
            ? `<div class="pubkey-wrapper">
           <span>${escapeHtml(pubkey)}</span>
           <span class="copy-icon copy-pubkey" title="Copy full pubkey">${copyIconSvg}</span>
         </div>`
            : "";
        tr.innerHTML = `
      <td class="dir dir-${dir}">${dir === "in" ? "←" : "→"}</td>
      <td class="type">${escapeHtml(type)}</td>
      <td class="kind" title="${kindTooltip}">${escapeHtml(String(kind))}</td>
      <td class="pubkey">${pubkeyHtml}</td>
      <td class="preview ${previewClass}">
        <div class="preview-wrapper">
          <span class="preview-content">${escapeHtml(previewContent)}</span>
          <span class="copy-icon copy-event" title="Copy full event">${copyIconSvg}</span>
        </div>
      </td>
    `;
        // Store data on the row element to avoid escaping issues
        tr.__copyData = {
            pubkey: fullPubkey,
            event: fullPreviewContent
        };
        // Add click handlers using event delegation on the row
        tr.addEventListener('click', (e) => {
            const target = e.target;
            const debugEl = document.getElementById('debugMsg');
            if (debugEl)
                debugEl.textContent = `Clicked: ${target.tagName}.${target.className}`;
            // Check if we clicked on a copy icon or its child
            const copyIcon = target.closest('.copy-icon');
            if (copyIcon) {
                e.preventDefault();
                e.stopPropagation();
                if (debugEl)
                    debugEl.textContent = 'Copy icon found!';
                let textToCopy = '';
                if (copyIcon.classList.contains('copy-pubkey')) {
                    textToCopy = tr.__copyData.pubkey;
                    if (debugEl)
                        debugEl.textContent = 'Copying pubkey...';
                }
                else if (copyIcon.classList.contains('copy-event')) {
                    textToCopy = tr.__copyData.event;
                    if (debugEl)
                        debugEl.textContent = 'Copying event...';
                }
                if (!textToCopy) {
                    if (debugEl)
                        debugEl.textContent = 'ERROR: No text to copy';
                    return;
                }
                // Use old-school execCommand since Clipboard API is blocked in DevTools
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = textToCopy;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    if (success) {
                        if (debugEl)
                            debugEl.textContent = 'Copied!';
                        showCopyFeedback(copyIcon);
                        setTimeout(() => {
                            if (debugEl)
                                debugEl.textContent = '';
                        }, 2000);
                    }
                    else {
                        if (debugEl)
                            debugEl.textContent = 'ERROR: Copy failed';
                    }
                }
                catch (err) {
                    if (debugEl)
                        debugEl.textContent = 'ERROR: ' + err.message;
                }
            }
        });
        this.rowsEl.insertBefore(tr, this.rowsEl.firstChild);
        // Limit to 500 rows
        if (this.rowsEl.children.length > 500 && this.rowsEl.lastChild) {
            this.rowsEl.removeChild(this.rowsEl.lastChild);
        }
    }
    clear() {
        this.rowsEl.innerHTML = "";
    }
}
const streamUI = new StreamUI();
