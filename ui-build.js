"use strict";
// UI for the Build tab
function escapeHtmlBuild(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
class BuildUI {
    constructor() {
        this.container = document.getElementById("build");
        // Subscribe to store changes to update when new kinds appear
        store.subscribe(() => {
            // Only render if the build tab is active
            const buildTab = document.getElementById('build');
            if (buildTab && buildTab.classList.contains('active')) {
                this.render();
            }
        });
    }
    render() {
        const allEvents = store.getAllEvents();
        // Collect all unique kinds
        const kindsMap = new Map(); // kind -> count
        for (const event of allEvents) {
            const type = event.frame[0];
            if (type === "EVENT") {
                const evt = event.frame[1]?.kind !== undefined ? event.frame[1] : event.frame[2];
                if (evt?.kind !== undefined) {
                    kindsMap.set(evt.kind, (kindsMap.get(evt.kind) || 0) + 1);
                }
            }
        }
        if (kindsMap.size === 0) {
            this.container.innerHTML = `
        <div class="build-container">
          <div class="empty-state">
            No event kinds captured yet. Start inspecting to see event kinds.
          </div>
        </div>
      `;
            return;
        }
        // Sort by kind number
        const sortedKinds = Array.from(kindsMap.keys()).sort((a, b) => a - b);
        const rows = sortedKinds.map((kind) => {
            const kindName = KIND_NAMES[kind] || "—";
            const nostrHubUrl = `https://nostrhub.io/kind/${kind}`;
            return `
        <tr>
          <td class="build-kind-number">${kind}</td>
          <td class="build-kind-name">${escapeHtmlBuild(kindName)}</td>
          <td class="build-kind-link">
            <a href="${nostrHubUrl}" target="_blank" rel="noopener noreferrer" class="nostrhub-link">
              View on NostrHub →
            </a>
          </td>
        </tr>
      `;
        }).join('');
        this.container.innerHTML = `
      <div class="build-container">
        <div class="build-header">
          <h2 class="build-title">Event Kinds Used</h2>
          <p class="build-description">
            All unique Nostr event kinds captured in this session. 
            Click "View on NostrHub" to see the NIP specification for each kind.
          </p>
          <p class="build-description">
            If you think a NIP could be improved or adapted to fit your needs, 
            discuss it on the NostrHub documentation site.
          </p>
        </div>
        
        <table class="build-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Name</th>
              <th class="text-right">Documentation</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
    }
}
const buildUI = new BuildUI();
