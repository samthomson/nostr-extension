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

// Reusable column filter for dropdown filtering
class ColumnFilter<T extends string | number> {
  private selected: Set<T> | null = null; // null = show all
  private allValues: Set<T> = new Set();
  private dropdown: HTMLElement;
  private header: HTMLElement;
  private optionsContainer: HTMLElement;
  private searchInput: HTMLInputElement;
  private formatLabel: (value: T) => string;
  private onChange: () => void;

  constructor(
    idPrefix: string,
    formatLabel: (value: T) => string,
    onChange: () => void
  ) {
    this.dropdown = document.getElementById(`${idPrefix}FilterDropdown`)!;
    this.header = document.getElementById(`${idPrefix}FilterHeader`)!;
    this.optionsContainer = document.getElementById(`${idPrefix}FilterOptions`)!;
    this.searchInput = document.getElementById(`${idPrefix}FilterSearch`) as HTMLInputElement;
    this.formatLabel = formatLabel;
    this.onChange = onChange;
    this.setup(idPrefix);
  }

  private setup(idPrefix: string): void {
    // Toggle dropdown
    this.header.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other dropdowns
      document.querySelectorAll('.filter-dropdown.active').forEach(d => {
        if (d !== this.dropdown) d.classList.remove('active');
      });
      this.dropdown.classList.toggle("active");
    });

    this.dropdown.addEventListener("click", (e) => e.stopPropagation());

    // Search
    this.searchInput.addEventListener("input", () => {
      this.filterOptions(this.searchInput.value);
    });

    // Select All
    document.getElementById(`${idPrefix}FilterSelectAll`)!.addEventListener("click", () => {
      this.selected = null;
      this.updateOptions(true);
      this.updateHeaderStyle();
      this.onChange();
    });

    // Clear
    document.getElementById(`${idPrefix}FilterClear`)!.addEventListener("click", () => {
      this.selected = new Set();
      this.updateOptions(true);
      this.updateHeaderStyle();
      this.onChange();
    });
  }

  updateOptions(forceUpdate: boolean = false, values: Set<T> = this.allValues): void {
    const valuesChanged = values.size !== this.allValues.size ||
      ![...values].every(v => this.allValues.has(v));

    if (valuesChanged || forceUpdate) {
      this.allValues = new Set(values);
      const sorted = Array.from(this.allValues).sort((a, b) => 
        String(a).localeCompare(String(b), undefined, { numeric: true })
      );

      this.optionsContainer.innerHTML = sorted.map(value => {
        const label = this.formatLabel(value);
        const checked = this.selected === null || this.selected.has(value);
        return `
          <label class="filter-option">
            <input type="checkbox" data-value="${escapeHtml(String(value))}" ${checked ? 'checked' : ''}>
            <span>${escapeHtml(label)}</span>
          </label>
        `;
      }).join('');

      this.optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
          const target = e.target as HTMLInputElement;
          const rawValue = target.dataset.value!;
          const value = (typeof [...this.allValues][0] === 'number' 
            ? parseInt(rawValue, 10) 
            : rawValue) as T;

          if (this.selected === null) {
            this.selected = new Set(this.allValues);
          }

          if (target.checked) {
            this.selected.add(value);
            if (this.selected.size === this.allValues.size) {
              this.selected = null;
            }
          } else {
            this.selected.delete(value);
          }

          this.updateHeaderStyle();
          this.onChange();
        });
      });
    }
  }

  private filterOptions(searchTerm: string): void {
    this.optionsContainer.querySelectorAll('.filter-option').forEach(option => {
      const text = (option as HTMLElement).textContent?.toLowerCase() || '';
      (option as HTMLElement).style.display = text.includes(searchTerm.toLowerCase()) ? 'flex' : 'none';
    });
  }

  private updateHeaderStyle(): void {
    this.header.classList.toggle("filter-active", this.selected !== null);
  }

  isSelected(value: T): boolean {
    if (this.selected === null) return true;
    return this.selected.has(value);
  }

  hasFilter(): boolean {
    return this.selected !== null;
  }

  isEmpty(): boolean {
    return this.selected !== null && this.selected.size === 0;
  }
}

class StreamUI {
  private rowsEl: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private expandCheckbox: HTMLInputElement;
  private includeWsEventsCheckbox: HTMLInputElement;
  private expandEvents: boolean = false;
  private includeWsEvents: boolean = false;
  private kindFilter: ColumnFilter<number>;
  private pubkeyFilter: ColumnFilter<string>;
  private relayFilter: ColumnFilter<string>;
  // Track unique values incrementally (more efficient than rebuilding each time)
  private uniqueKinds = new Set<number>();
  private uniquePubkeys = new Set<string>();
  private uniqueRelays = new Set<string>();
  private lastEventCount = 0;
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
    
    this.statElements = {
      total: document.getElementById("stat-total")!,
      ws: document.getElementById("stat-ws")!,
      nostr: document.getElementById("stat-nostr")!,
      subsOpened: document.getElementById("stat-subs-opened")!,
      subsClosed: document.getElementById("stat-subs-closed")!,
      subsOpen: document.getElementById("stat-subs-open")!,
      kinds: document.getElementById("stat-kinds")!
    };
    
    const reRender = () => this.reRenderAllRows();
    
    this.kindFilter = new ColumnFilter<number>("kind", (kind) => {
      const name = getKindName(kind);
      return name ? `${kind} - ${name}` : String(kind);
    }, reRender);
    
    this.pubkeyFilter = new ColumnFilter<string>("pubkey", (pk) => 
      pk.substring(0, 8) + "..." + pk.substring(pk.length - 8), reRender);
    
    this.relayFilter = new ColumnFilter<string>("relay", (r) => r || "(no relay)", reRender);
    
    this.setupControls();
    this.setupDropdownClose();
    this.updateStats();
    
    // Subscribe to store changes to update stats
    store.subscribe(() => {
      this.updateStats();
      this.updateFilterOptions();
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
  
  private setupDropdownClose(): void {
    // Close all dropdowns when clicking outside
    document.addEventListener("click", () => {
      document.querySelectorAll('.filter-dropdown.active').forEach(d => {
        d.classList.remove('active');
      });
    });
  }
  
  private updateFilterOptions(): void {
    const allEvents = store.getAllEvents();
    const eventCount = allEvents.length;
    
    // If events were cleared, reset our tracking
    if (eventCount < this.lastEventCount) {
      this.uniqueKinds.clear();
      this.uniquePubkeys.clear();
      this.uniqueRelays.clear();
      this.lastEventCount = 0;
    }
    
    // Only process new events (incremental update)
    for (let i = this.lastEventCount; i < eventCount; i++) {
      const event = allEvents[i];
      const type = event.frame[0];
      // Use empty string as key for missing relay
      this.uniqueRelays.add(event.relay || "");
      if (type === "EVENT") {
        const evt = event.frame[1]?.kind !== undefined ? event.frame[1] : event.frame[2];
        if (evt?.kind !== undefined) this.uniqueKinds.add(evt.kind);
        if (evt?.pubkey) this.uniquePubkeys.add(evt.pubkey);
      }
    }
    
    this.lastEventCount = eventCount;
    
    this.kindFilter.updateOptions(false, this.uniqueKinds);
    this.pubkeyFilter.updateOptions(false, this.uniquePubkeys);
    this.relayFilter.updateOptions(false, this.uniqueRelays);
  }
  
  private shouldShowEvent(msg: any): boolean {
    const type = msg.frame[0];
    
    // Filter WebSocket protocol events (REQ, CLOSE, EOSE) unless includeWsEvents is checked
    if (type !== "EVENT" && !this.includeWsEvents) {
      return false;
    }
    
    // Check relay filter (applies to all message types)
    // Use empty string for missing relay to match how we track them
    if (!this.relayFilter.isSelected(msg.relay || "")) {
      return false;
    }
    
    // If it's not an EVENT, show it (because includeWsEvents must be true at this point)
    if (type !== "EVENT") return true;
    
    // For EVENT messages, apply kind and pubkey filters
    const evt = msg.frame[1]?.kind !== undefined ? msg.frame[1] : msg.frame[2];
    
    if (evt?.kind !== undefined && !this.kindFilter.isSelected(evt.kind)) {
      return false;
    }
    
    if (evt?.pubkey && !this.pubkeyFilter.isSelected(evt.pubkey)) {
      return false;
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
      ? (dir === "in" ? "READ" : "WRITE")
      : (dir === "in" ? "IN" : "OUT");
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

