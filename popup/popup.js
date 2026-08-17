/**
 * DineExpress - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const restaurantInput = document.getElementById('restaurantInput');
  const searchBtn = document.getElementById('searchBtn');
  const countySelect = document.getElementById('countySelect');
  const resultsSection = document.getElementById('resultsSection');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const cacheStatsText = document.getElementById('cacheStatsText');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // 1. Tab Switching
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // 2. Refresh Cache Stats
  function updateCacheStats() {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
      if (res && res.success) {
        cacheStatsText.textContent = `${res.cachedItemsCount} restaurant inspection records cached locally.`;
      }
    });
  }
  updateCacheStats();

  // 3. Clear Cache Action
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, (res) => {
        if (res && res.success) {
          cacheStatsText.textContent = 'Cache cleared (0 records).';
          alert('Local inspection cache cleared successfully.');
        }
      });
    });
  }

  // 4. Perform Search
  async function performSearch() {
    const query = restaurantInput.value.trim();
    if (!query) return;

    const selectedCounty = countySelect.value;
    searchBtn.textContent = 'Searching...';
    searchBtn.disabled = true;
    resultsSection.style.display = 'block';
    resultsSection.innerHTML = `
      <div class="result-card">
        <p style="color: #64748b; font-size: 12px;">Searching Bay Area County records for "${query}"...</p>
      </div>
    `;

    chrome.runtime.sendMessage(
      {
        type: 'SEARCH_HEALTH_REPORT',
        payload: {
          restaurantName: query,
          address: '',
          explicitCountyId: selectedCounty,
          bypassCache: false
        }
      },
      (response) => {
        searchBtn.textContent = 'Search';
        searchBtn.disabled = false;

        if (!response || !response.success || !response.data) {
          resultsSection.innerHTML = `
            <div class="result-card">
              <div class="result-head">
                <span class="result-title">${escapeHtml(query)}</span>
                <span class="result-placard neutral">No Record</span>
              </div>
              <p class="result-meta">No inspection record found in Bay Area health databases.</p>
            </div>
          `;
          return;
        }

        const data = response.data;
        const placard = data.placard || { label: 'Inspected', badgeClass: 'neutral', icon: 'ℹ️' };
        const isMatched = data.matched && data.latestInspection;
        const viewUrl = data.officialDatasetUrl || data.portalUrl || data.searchDeepLink || 'https://data.sfgov.org';

        resultsSection.innerHTML = `
          <div class="result-card">
            <div class="result-head">
              <span class="result-title">${escapeHtml(data.businessName || query)}</span>
              <span class="result-placard ${placard.badgeClass || 'neutral'}">
                ${placard.icon || ''} ${escapeHtml(placard.label)}
              </span>
            </div>
            <div class="result-meta">
              <span>🏛️ ${escapeHtml(data.countyName)}</span>
              ${data.score !== null ? ` • <strong>Score: ${data.score}/100</strong>` : ''}
              ${isMatched ? ` • ${data.latestInspection.date}` : ''}
            </div>
            ${isMatched && data.latestInspection ? `
              <div class="result-violations">
                <div><strong>Inspection:</strong> ${escapeHtml(data.latestInspection.type)}</div>
                <div style="margin-top: 4px; color: ${data.latestInspection.criticalViolationsCount > 0 ? '#b91c1c' : '#047857'}">
                  ${data.latestInspection.criticalViolationsCount > 0 ? `⚠️ ${data.latestInspection.criticalViolationsCount} Critical Violations` : '✅ 0 Critical Violations'}
                  ${data.latestInspection.violationsCount > 0 ? ` (${data.latestInspection.violationsCount} total)` : ''}
                </div>
                ${data.latestInspection.comment ? `
                  <div style="margin-top: 4px; font-style: italic; color: #64748b; font-size: 10px;">
                    "${escapeHtml(data.latestInspection.comment.slice(0, 120))}..."
                  </div>
                ` : ''}
              </div>
            ` : ''}
            <div class="result-footer">
              <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="result-link">
                View Official County Records ↗
              </a>
            </div>
          </div>
        `;
      }
    );
  }

  searchBtn.addEventListener('click', performSearch);
  restaurantInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
