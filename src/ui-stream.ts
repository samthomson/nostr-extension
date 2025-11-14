// UI for the Event Stream tab

interface NostrEvent {
  kind?: number;
  pubkey?: string;
  content?: string;
}

interface NostrFilter {
  kinds?: number[];
}

// Common Nostr event kind descriptions
const KIND_NAMES: { [kind: number]: string } = {
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

function getKindName(kind: number | string): string {
  if (!kind) return "";
  const kindNum = typeof kind === "string" ? parseInt(kind, 10) : kind;
  return KIND_NAMES[kindNum] || "";
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

class StreamUI {
  private rowsEl: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
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
    this.updateStats();
    
    // Subscribe to store changes to update stats
    store.subscribe(() => this.updateStats());
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
    // Don't add rows if paused
    if (store.isPaused()) return;
    const { dir, frame } = msg;
    const type = frame[0];
    let kind: number | string = "";
    let pubkey = "";
    
    if (type === "EVENT") {
      const evt: NostrEvent = frame[1]?.kind !== undefined ? frame[1] : frame[2];
      if (evt) {
        kind = evt.kind ?? "";
        pubkey = evt.pubkey ? evt.pubkey.substring(0, 16) + "..." : "";
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
    
    this.rowsEl.insertBefore(tr, this.rowsEl.firstChild);
    
    if (this.rowsEl.children.length > 500 && this.rowsEl.lastChild) {
      this.rowsEl.removeChild(this.rowsEl.lastChild);
    }
  }
  
  clear(): void {
    this.rowsEl.innerHTML = "";
  }
}

const streamUI = new StreamUI();

