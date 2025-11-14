// UI for the Summary tab

const SUMMARY_KIND_NAMES: { [key: number]: string } = {
  0: "Metadata", 1: "Text Note", 2: "Relay Rec", 3: "Contacts", 4: "DM", 5: "Event Deletion",
  6: "Repost", 7: "Reaction", 8: "Badge Award", 9: "Group Chat", 10: "Group Note", 11: "Group Reply",
  12: "Group Thread", 13: "Seal", 16: "Generic Repost", 40: "Channel Create", 41: "Channel Metadata",
  42: "Channel Message", 43: "Channel Hide", 44: "Channel Mute", 818: "Merge Requests",
  1021: "Bid", 1022: "Bid confirmation", 1040: "OpenTimestamps", 1059: "Gift Wrap", 1063: "File Metadata",
  1311: "Live Chat Message", 1617: "Patches", 1621: "Issues", 1622: "Replies", 1630: "Status",
  1971: "Problem Tracker", 1984: "Reporting", 1985: "Label", 2003: "Tortuga Index", 2004: "Tortuga comment",
  2022: "Coinjoin Pool", 4550: "Community Post Approval", 5000: "DM relays", 5999: "Nip90: Data Vending",
  6000: "Cashu Wallet", 7000: "Job Feedback", 7374: "Reserved", 7375: "Reserved", 7376: "Reserved",
  9000: "Group Control Events", 9041: "Zap Goal", 9467: "Tidal login", 9734: "Zap Request", 9735: "Zap",
  9802: "Highlights", 10000: "Mute list", 10001: "Pin list", 10002: "Relay list", 10003: "Bookmarks",
  10004: "Communities", 10005: "Public chats", 10006: "Blocked relays", 10007: "Search relays",
  10009: "User groups", 10015: "Interests list", 10019: "Nutzap Mints", 10030: "User emoji list",
  10050: "Relay list", 10063: "User server list", 10096: "File storage", 13194: "Wallet Info",
  21000: "Lightning Pub RPC", 22242: "Client Auth", 23194: "Wallet Request", 23195: "Wallet Response",
  24133: "Nostr Connect", 27235: "HTTP Auth", 30000: "Categorized People", 30001: "Categorized Bookmarks",
  30002: "Relay Sets", 30003: "Bookmark Sets", 30004: "Curation Sets", 30005: "Video Sets",
  30007: "Mute Sets", 30008: "Profile Badges", 30009: "Badge Definition", 30015: "Interest Sets",
  30017: "Create/Update a Stall", 30018: "Create/Update a Product", 30019: "Marketplace UI/UX",
  30020: "Product sold as an auction", 30023: "Long-form Content", 30024: "Draft Long-form",
  30030: "Emoji sets", 30040: "Modular Article Header", 30041: "Modular Article Content",
  30063: "Release artifact sets", 30078: "App Data", 30311: "Live Event", 30315: "User Status",
  30388: "Slide Set", 30402: "Classified Listing", 30403: "Draft Classified Listing",
  30617: "Repository", 30618: "Repository", 30819: "Timestamp", 31234: "Draft Event",
  31388: "Link Set", 31890: "Feed", 31922: "Date-Based Calendar Event", 31923: "Time-Based Calendar Event",
  31924: "Calendar", 31925: "Calendar Event RSVP", 31989: "Handler recommendation",
  31990: "Handler information", 34235: "Video Event", 34236: "Short-form Portrait Video Event",
  34237: "Video View Event", 34550: "Community Definition", 38383: "Peer-to-peer Order events"
};

function getSummaryKindName(kind: number | string): string {
  if (!kind) return "";
  const kindNum = typeof kind === "string" ? parseInt(kind, 10) : kind;
  return SUMMARY_KIND_NAMES[kindNum] || "";
}

function escapeHtmlSummary(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

class SummaryUI {
  render(): void {
    const container = document.getElementById("summary")!;
    
    const stats = store.getStats();
    const kindCounts = store.getKindCounts();
    const allEvents = store.getAllEvents();
    
    // Get sample events for each kind
    const samplesByKind = new Map<number, any>();
    for (const event of allEvents) {
      const type = event.frame[0];
      if (type === "EVENT") {
        const evt = event.frame[1]?.kind !== undefined ? event.frame[1] : event.frame[2];
        if (evt?.kind !== undefined && !samplesByKind.has(evt.kind)) {
          samplesByKind.set(evt.kind, evt);
        }
      }
    }
    
    container.innerHTML = `
      <div class="summary-container">
        <h2 class="summary-title">Summary</h2>
        
        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-card-label">Total Events</div>
            <div class="summary-card-value">${stats.total.toLocaleString()}</div>
          </div>
          
          <div class="summary-card">
            <div class="summary-card-label">Nostr Events</div>
            <div class="summary-card-value">${stats.nostrEvents.toLocaleString()}</div>
          </div>
          
          <div class="summary-card">
            <div class="summary-card-label">Subscriptions</div>
            <div class="summary-card-value">
              ${stats.subsOpened.toLocaleString()}
              <span class="summary-card-value-small">(${stats.subsOpen} open)</span>
            </div>
          </div>
        </div>
        
        ${kindCounts.size > 0 ? `
          <h3 class="summary-section-title">Event Kinds</h3>
          <table class="summary-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Name</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from(kindCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([kind, count]) => {
                  const kindName = getSummaryKindName(kind);
                  return `
                    <tr>
                      <td><span class="summary-kind-number">${kind}</span></td>
                      <td><span class="summary-kind-name">${kindName || '—'}</span></td>
                      <td>${count.toLocaleString()}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
          </table>
          
          <h3 class="summary-section-title">Sample Events by Kind</h3>
          ${Array.from(kindCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([kind, count]) => {
              const sample = samplesByKind.get(kind);
              const kindName = getSummaryKindName(kind);
              if (!sample) return '';
              
              return `
                <div class="sample-event">
                  <div class="sample-event-header">
                    <div class="sample-event-title">
                      <span class="sample-event-kind">Kind ${kind}</span>
                      ${kindName ? `<span class="sample-event-name">${kindName}</span>` : ''}
                    </div>
                    <span class="sample-event-count">${count.toLocaleString()} event${count !== 1 ? 's' : ''}</span>
                  </div>
                  <div class="sample-event-body">
                    <pre class="sample-event-pre">${escapeHtmlSummary(JSON.stringify(sample, null, 2))}</pre>
                  </div>
                </div>
              `;
            }).join('')}
        ` : '<div class="empty-state">No Nostr events captured yet</div>'}
      </div>
    `;
  }
}

const summaryUI = new SummaryUI();

