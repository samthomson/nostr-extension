// UI for the Summary tab

class SummaryUI {
  render(): void {
    const container = document.getElementById("summary")!;
    
    const typeCounts = store.getTypeCounts();
    const kindCounts = store.getKindCounts();
    const uniquePubkeys = store.getUniquePubkeys();
    const dirCounts = store.getDirectionCounts();
    const allEvents = store.getAllEvents();
    
    container.innerHTML = `
      <div style="padding: 16px; font-size: 13px;">
        <h2 style="margin: 0 0 16px 0; font-size: 16px;">Summary</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">Total Events</div>
            <div style="font-size: 24px; font-weight: 700;">${allEvents.length}</div>
          </div>
          
          <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">Unique Pubkeys</div>
            <div style="font-size: 24px; font-weight: 700;">${uniquePubkeys.size}</div>
          </div>
          
          <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">Incoming / Outgoing</div>
            <div style="font-size: 24px; font-weight: 700;">${dirCounts.in} / ${dirCounts.out}</div>
          </div>
        </div>
        
        <h3 style="margin: 24px 0 8px 0; font-size: 14px;">Message Types</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead style="background: #f5f5f5;">
            <tr>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Type</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Count</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(typeCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${type}</td>
                  <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${count}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
        
        ${kindCounts.size > 0 ? `
          <h3 style="margin: 24px 0 8px 0; font-size: 14px;">Event Kinds</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #f5f5f5;">
              <tr>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Kind</th>
                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Count</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from(kindCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([kind, count]) => `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${kind}</td>
                    <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${count}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }
}

const summaryUI = new SummaryUI();

