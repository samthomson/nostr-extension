// UI for the Summary tab

// KIND_NAMES is defined globally in kinds.js (loaded first in panel.html)
function getSummaryKindName(kind: number | string): string {
  if (kind === undefined || kind === null || kind === "") return "";
  const kindNum = typeof kind === "string" ? parseInt(kind, 10) : kind;
  return KIND_NAMES[kindNum] || "";
}

function escapeHtmlSummary(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

class SummaryUI {
  constructor() {
    // Subscribe to store changes and re-render when data updates
    store.subscribe(() => {
      // Only render if the summary tab is currently active
      const summaryTab = document.getElementById("summary");
      if (summaryTab && summaryTab.classList.contains("active")) {
        this.render();
      }
    });
  }
  
  render(): void {
    const container = document.getElementById("summary");
    if (!container) return;
    
    // Save scroll position before re-rendering
    const scrollContainer = container.querySelector('.summary-container') as HTMLElement;
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    
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
    
    // Restore scroll position after re-rendering
    const newScrollContainer = container.querySelector('.summary-container') as HTMLElement;
    if (newScrollContainer && scrollTop > 0) {
      newScrollContainer.scrollTop = scrollTop;
    }
  }
}

const summaryUI = new SummaryUI();

