"use strict";
// Central data store for all Nostr events and derived data
class NostrStore {
    constructor() {
        this.events = [];
        this.listeners = [];
        this.paused = false;
    }
    // Add a new event
    addEvent(msg) {
        if (!this.paused) {
            this.events.push(msg);
            this.notify();
        }
    }
    // Pause/resume capturing
    setPaused(paused) {
        this.paused = paused;
    }
    isPaused() {
        return this.paused;
    }
    // Get all events
    getAllEvents() {
        return this.events;
    }
    // Get events with a limit (for stream view)
    getRecentEvents(limit = 500) {
        return this.events.slice(-limit);
    }
    // Derived data: counts by type
    getTypeCounts() {
        const counts = new Map();
        for (const event of this.events) {
            const type = event.frame[0];
            counts.set(type, (counts.get(type) || 0) + 1);
        }
        return counts;
    }
    // Derived data: counts by kind
    getKindCounts() {
        const counts = new Map();
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
    getUniquePubkeys() {
        const pubkeys = new Set();
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
    getDirectionCounts() {
        let inCount = 0;
        let outCount = 0;
        for (const event of this.events) {
            if (event.dir === "in")
                inCount++;
            else
                outCount++;
        }
        return { in: inCount, out: outCount };
    }
    // Clear all data
    clear() {
        this.events = [];
        this.notify();
    }
    // Subscribe to changes
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }
    notify() {
        for (const listener of this.listeners) {
            listener();
        }
    }
}
// Single global instance
const store = new NostrStore();
