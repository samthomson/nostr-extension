// UI for the Event Stream tab

interface NostrEvent {
  kind?: number;
  pubkey?: string;
  content?: string;
}

interface NostrFilter {
  kinds?: number[];
}

// KIND_NAMES is defined globally in kinds.js (loaded first in panel.html)
function getKindName(kind: number | string): string {
  if (kind === undefined || kind === null || kind === "") return "";
  const kindNum = typeof kind === "string" ? parseInt(kind, 10) : kind;
  return KIND_NAMES[kindNum] || "";
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showCopyFeedback(iconEl: HTMLElement): void {
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
  private rowsEl: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private expandCheckbox: HTMLInputElement;
  private includeWsEventsCheckbox: HTMLInputElement;
  private expandEvents: boolean = false;
  private includeWsEvents: boolean = false;
  private selectedKinds: Set<number> | null = null; // null = show all (no filter)
  private allKinds: Set<number> = new Set();
  private filterDropdown: HTMLElement;
  private filterHeader: HTMLElement;
  private statElements: {
    total: HTMLElement;
    ws: HTMLElement;
    nostr: HTMLElement;
    subsOpened: HTMLElement;
    subsClosed: HTMLElement;
    subsOpen: HTMLElement;
    kinds: HTMLElement;
  };
  
  constructor() {
    this.rowsEl = document.getElementById("rows")!;
    this.pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement;
    this.clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
    this.expandCheckbox = document.getElementById("expandEventsCheckbox") as HTMLInputElement;
    this.includeWsEventsCheckbox = document.getElementById("includeWsEventsCheckbox") as HTMLInputElement;
    this.filterDropdown = document.getElementById("kindFilterDropdown")!;
    this.filterHeader = document.getElementById("kindFilterHeader")!;
    
    this.statElements = {
      total: document.getElementById("stat-total")!,
      ws: document.getElementById("stat-ws")!,
      nostr: document.getElementById("stat-nostr")!,
      subsOpened: document.getElementById("stat-subs-opened")!,
      subsClosed: document.getElementById("stat-subs-closed")!,
      subsOpen: document.getElementById("stat-subs-open")!,
      kinds: document.getElementById("stat-kinds")!
    };
    
    this.setupControls();
    this.setupKindFilter();
    this.updateStats();
    
    // Subscribe to store changes to update stats
    store.subscribe(() => {
      this.updateStats();
      this.updateKindFilterOptions();
    });
  }
  
  private setupControls(): void {
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
    
    // Include WebSocket events checkbox
    this.includeWsEventsCheckbox.addEventListener("change", () => {
      this.includeWsEvents = this.includeWsEventsCheckbox.checked;
      this.reRenderAllRows();
    });
  }
  
  private setupKindFilter(): void {
    // Toggle dropdown
    this.filterHeader.addEventListener("click", (e) => {
      e.stopPropagation();
      this.filterDropdown.classList.toggle("active");
    });
    
    // Close dropdown when clicking outside
    document.addEventListener("click", () => {
      this.filterDropdown.classList.remove("active");
    });
    
    this.filterDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    
    // Search functionality
    const searchInput = document.getElementById("kindFilterSearch") as HTMLInputElement;
    searchInput.addEventListener("input", () => {
      this.filterKindOptions(searchInput.value);
    });
    
    // Select All button
    const selectAllBtn = document.getElementById("kindFilterSelectAll")!;
    selectAllBtn.addEventListener("click", () => {
      this.selectedKinds = null; // null means no filter, show all
      this.updateKindFilterOptions(true); // force update to refresh checkboxes
      this.updateFilterHeaderStyle();
      this.reRenderAllRows();
    });
    
    // Clear button
    const clearBtn = document.getElementById("kindFilterClear")!;
    clearBtn.addEventListener("click", () => {
      this.selectedKinds = new Set(); // empty set means show nothing
      this.updateKindFilterOptions(true); // force update to refresh checkboxes
      this.updateFilterHeaderStyle();
      this.reRenderAllRows();
    });
  }
  
  private updateKindFilterOptions(forceUpdate: boolean = false): void {
    const optionsContainer = document.getElementById("kindFilterOptions")!;
    const allEvents = store.getAllEvents();
    
    // Collect all unique kinds from events
    const newKinds = new Set<number>();
    for (const event of allEvents) {
      const type = event.frame[0];
      if (type === "EVENT") {
        const evt = event.frame[1]?.kind !== undefined ? event.frame[1] : event.frame[2];
        if (evt?.kind !== undefined) {
          newKinds.add(evt.kind);
        }
      }
    }
    
    // Update if kinds have changed OR if forced
    const kindsChanged = newKinds.size !== this.allKinds.size || 
                         ![...newKinds].every(k => this.allKinds.has(k));
    
    if (kindsChanged || forceUpdate) {
      this.allKinds = newKinds;
      
      // Sort kinds
      const sortedKinds = Array.from(this.allKinds).sort((a, b) => a - b);
      
      optionsContainer.innerHTML = sortedKinds.map(kind => {
        const kindName = getKindName(kind);
        const label = kindName ? `${kind} - ${kindName}` : String(kind);
        const checked = this.selectedKinds === null || this.selectedKinds.has(kind);
        
        return `
          <label class="filter-option">
            <input type="checkbox" data-kind="${kind}" ${checked ? 'checked' : ''}>
            <span>${escapeHtml(label)}</span>
          </label>
        `;
      }).join('');
      
      // Add event listeners to checkboxes
      optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
          const target = e.target as HTMLInputElement;
          const kind = parseInt(target.dataset.kind!);
          
          // Initialize filter if not yet active
          if (this.selectedKinds === null) {
            // Start with all kinds selected except the one being unchecked
            this.selectedKinds = new Set(this.allKinds);
          }
          
          if (target.checked) {
            this.selectedKinds.add(kind);
            // If all are now selected, clear the filter (show all)
            if (this.selectedKinds.size === this.allKinds.size) {
              this.selectedKinds = null;
            }
          } else {
            this.selectedKinds.delete(kind);
          }
          
          this.updateFilterHeaderStyle();
          this.reRenderAllRows();
        });
      });
    }
  }
  
  private filterKindOptions(searchTerm: string): void {
    const optionsContainer = document.getElementById("kindFilterOptions")!;
    const options = optionsContainer.querySelectorAll('.filter-option');
    
    options.forEach(option => {
      const text = (option as HTMLElement).textContent?.toLowerCase() || '';
      const matches = text.includes(searchTerm.toLowerCase());
      (option as HTMLElement).style.display = matches ? 'flex' : 'none';
    });
  }
  
  private updateFilterHeaderStyle(): void {
    // Show filter as active if it's not null (meaning a filter is applied)
    if (this.selectedKinds !== null) {
      this.filterHeader.classList.add("filter-active");
    } else {
      this.filterHeader.classList.remove("filter-active");
    }
  }
  
  private shouldShowEvent(msg: any): boolean {
    const type = msg.frame[0];
    
    // Filter WebSocket protocol events (REQ, CLOSE, EOSE) unless includeWsEvents is checked
    if (type !== "EVENT" && !this.includeWsEvents) {
      return false;
    }
    
    // If it's not an EVENT, show it (because includeWsEvents must be true at this point)
    if (type !== "EVENT") return true;
    
    // For EVENT messages, apply kind filter
    // If no filter is active (null), show all
    if (this.selectedKinds === null) return true;
    
    // If filter is active but empty, show nothing
    if (this.selectedKinds.size === 0) return false;
    
    // Check if event kind is in selected kinds
    const evt = msg.frame[1]?.kind !== undefined ? msg.frame[1] : msg.frame[2];
    if (evt?.kind !== undefined) {
      return this.selectedKinds.has(evt.kind);
    }
    
    return true;
  }
  
  private reRenderAllRows(): void {
    // Get all current events from store
    const allEvents = store.getAllEvents();
    
    // Clear the table
    this.rowsEl.innerHTML = "";
    
    // Re-render filtered events with new expand setting
    // Reverse to maintain newest-first order
    for (let i = allEvents.length - 1; i >= 0; i--) {
      if (this.shouldShowEvent(allEvents[i])) {
        this.renderRow(allEvents[i]);
      }
    }
  }
  
  private updatePauseButton(): void {
    const isPaused = store.isPaused();
    if (isPaused) {
      this.pauseBtn.textContent = "Resume";
      this.pauseBtn.classList.add("paused");
    } else {
      this.pauseBtn.textContent = "Pause";
      this.pauseBtn.classList.remove("paused");
    }
  }
  
  private updateStats(): void {
    const stats = store.getStats();
    this.statElements.total.textContent = stats.total.toLocaleString();
    this.statElements.ws.textContent = stats.wsEvents.toLocaleString();
    this.statElements.nostr.textContent = stats.nostrEvents.toLocaleString();
    this.statElements.subsOpened.textContent = stats.subsOpened.toLocaleString();
    this.statElements.subsClosed.textContent = stats.subsClosed.toLocaleString();
    this.statElements.subsOpen.textContent = stats.subsOpen.toLocaleString();
    this.statElements.kinds.textContent = stats.uniqueKinds.toLocaleString();
  }
  
  addRow(msg: any): void {
    // Don't add rows if paused or filtered out
    if (store.isPaused()) return;
    if (!this.shouldShowEvent(msg)) return;
    this.renderRow(msg);
  }
  
  private renderRow(msg: any): void {
    const { dir, frame, relay } = msg;
    const type = frame[0];
    let kind: number | string = "";
    let pubkey = "";
    let fullPubkey = "";
    
    if (type === "EVENT") {
      const evt: NostrEvent = frame[1]?.kind !== undefined ? frame[1] : frame[2];
      if (evt) {
        kind = evt.kind ?? "";
        fullPubkey = evt.pubkey || "";
        pubkey = fullPubkey ? fullPubkey.substring(0, 16) + "..." : "";
      }
    } else if (type === "REQ") {
      const filters = frame.slice(2) as NostrFilter[];
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
      } else {
        previewContent = JSON.stringify(evt).substring(0, 100);
        if (JSON.stringify(evt).length > 100) previewContent += "...";
      }
    } else {
      // For non-EVENT messages, show the frame
      fullPreviewContent = JSON.stringify(frame, null, 2);
      if (this.expandEvents) {
        previewContent = fullPreviewContent;
      } else {
        previewContent = JSON.stringify(frame).substring(0, 100);
        if (JSON.stringify(frame).length > 100) previewContent += "...";
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
    
    const isEventMessage = type === "EVENT";
    const ioText = isEventMessage
      ? (dir === "in" ? "read" : "write")
      : (dir === "in" ? "in" : "out");
    const dirKindClass = isEventMessage ? "dir-nostr" : "dir-ws";

    tr.innerHTML = `
      <td class="dir dir-${dir} ${dirKindClass}">
        <span class="dir-label">${ioText}</span>
      </td>
      <td class="type">${escapeHtml(type)}</td>
      <td class="kind" title="${kindTooltip}">${escapeHtml(String(kind))}</td>
      <td class="pubkey">${pubkeyHtml}</td>
      <td class="relay">${relay ? escapeHtml(relay) : ""}</td>
      <td class="preview ${previewClass}">
        <div class="preview-wrapper">
          <span class="preview-content">${escapeHtml(previewContent)}</span>
          <span class="copy-icon copy-event" title="Copy full event">${copyIconSvg}</span>
        </div>
      </td>
    `;
    
    // Store data on the row element to avoid escaping issues
    (tr as any).__copyData = {
      pubkey: fullPubkey,
      event: fullPreviewContent
    };
    
    // Add click handlers using event delegation on the row
    tr.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // Check if we clicked on a copy icon or its child
      const copyIcon = target.closest('.copy-icon');
      if (copyIcon) {
        e.preventDefault();
        e.stopPropagation();
        
        let textToCopy = '';
        if (copyIcon.classList.contains('copy-pubkey')) {
          textToCopy = (tr as any).__copyData.pubkey;
        } else if (copyIcon.classList.contains('copy-event')) {
          textToCopy = (tr as any).__copyData.event;
        }
        
        if (!textToCopy) {
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
            showCopyFeedback(copyIcon as HTMLElement);
          }
        } catch (err) {
          // Silently fail
        }
      }
    });
    
    this.rowsEl.insertBefore(tr, this.rowsEl.firstChild);
    
    // Limit to 500 rows
    if (this.rowsEl.children.length > 500 && this.rowsEl.lastChild) {
      this.rowsEl.removeChild(this.rowsEl.lastChild);
    }
  }
  
  clear(): void {
    this.rowsEl.innerHTML = "";
  }
}

const streamUI = new StreamUI();

