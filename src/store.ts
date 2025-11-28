// Central data store for all Nostr events and derived data

interface NostrMessage {
  type: "nostr";
  dir: "in" | "out";
  frame: any[];
  timestamp?: number;
  relay?: string;
}

class NostrStore {
  private events: NostrMessage[] = [];
  private listeners: Array<() => void> = [];
  private paused: boolean = false;
  private subscriptions: Set<string> = new Set(); // Track open subscription IDs
  private closedSubscriptions: Set<string> = new Set(); // Track closed subscription IDs
  
  // Add a new event
  addEvent(msg: NostrMessage): void {
    if (!this.paused) {
      this.events.push(msg);
      
      // Track subscriptions
      const type = msg.frame[0];
      if (type === "REQ" && msg.frame[1]) {
        this.subscriptions.add(msg.frame[1]); // REQ subscription ID is second element
      } else if (type === "CLOSE" && msg.frame[1]) {
        this.closedSubscriptions.add(msg.frame[1]);
      }
      
      this.notify();
    }
  }
  
  // Pause/resume capturing
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  
  isPaused(): boolean {
    return this.paused;
  }
  
  // Get all events
  getAllEvents(): NostrMessage[] {
    return this.events;
  }
  
  // Get events with a limit (for stream view)
  getRecentEvents(limit: number = 500): NostrMessage[] {
    return this.events.slice(-limit);
  }
  
  // Derived data: counts by type
  getTypeCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const event of this.events) {
      const type = event.frame[0];
      counts.set(type, (counts.get(type) || 0) + 1);
    }
    return counts;
  }
  
  // Derived data: counts by kind
  getKindCounts(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const event of this.events) {
      const type = event.frame[0];
      if (type === "EVENT") {
        const evt = event.frame[1]?.kind !== undefined ? event.frame[1] : event.frame[2];
        if (evt?.kind !== undefined) {
          counts.set(evt.kind, (counts.get(evt.kind) || 0) + 1);
        }
      }
    }
    return counts;
  }
  
  // Derived data: unique pubkeys
  getUniquePubkeys(): Set<string> {
    const pubkeys = new Set<string>();
    for (const event of this.events) {
      const type = event.frame[0];
      if (type === "EVENT") {
        const evt = event.frame[1]?.pubkey ? event.frame[1] : event.frame[2];
        if (evt?.pubkey) {
          pubkeys.add(evt.pubkey);
        }
      }
    }
    return pubkeys;
  }
  
  // Derived data: direction counts
  getDirectionCounts(): { in: number; out: number } {
    let inCount = 0;
    let outCount = 0;
    for (const event of this.events) {
      if (event.dir === "in") inCount++;
      else outCount++;
    }
    return { in: inCount, out: outCount };
  }
  
  // Get stats
  getStats() {
    const wsTypes = new Set(["REQ", "EOSE", "CLOSE", "NOTICE", "OK", "AUTH", "COUNT"]);
    let wsEventCount = 0;
    let nostrEventCount = 0;
    
    for (const event of this.events) {
      const type = event.frame[0];
      if (type === "EVENT") {
        nostrEventCount++;
      } else if (wsTypes.has(type)) {
        wsEventCount++;
      }
    }
    
    const uniqueKinds = this.getKindCounts().size;
    const openSubs = this.subscriptions.size - this.closedSubscriptions.size;
    
    return {
      total: this.events.length,
      wsEvents: wsEventCount,
      nostrEvents: nostrEventCount,
      subsOpened: this.subscriptions.size,
      subsClosed: this.closedSubscriptions.size,
      subsOpen: Math.max(0, openSubs),
      uniqueKinds: uniqueKinds
    };
  }
  
  // Clear all data
  clear(): void {
    this.events = [];
    this.subscriptions.clear();
    this.closedSubscriptions.clear();
    this.notify();
  }
  
  // Subscribe to changes
  subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
  
  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// Single global instance
const store = new NostrStore();

