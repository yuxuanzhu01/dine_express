/**
 * DineExpress - Google Maps Content Script
 * Automatically detects restaurant place pages and injects real-time Bay Area health inspection scores.
 */

(() => {
  let currentPlaceId = null;
  let currentContainer = null;
  let observer = null;

  console.log('🍽️ DineExpress: Bay Area Health Inspector content script initialized.');

  /**
   * Extracts current place information from Google Maps DOM
   */
  function extractPlaceInfo() {
    // 1. Extract Place Name
    const titleEl = document.querySelector('h1.DUwDvf, div[role="main"] h1, h1.fontHeadlineLarge, div.fontHeadlineLarge');
    if (!titleEl || !titleEl.textContent.trim()) {
      return null;
    }
    const name = titleEl.textContent.trim();

    // 2. Extract Address
    let address = '';
    const addressBtn = document.querySelector('button[data-item-id="address"], button[aria-label*="Address:"], [data-tooltip="Copy address"]');
    if (addressBtn) {
      address = (addressBtn.getAttribute('aria-label') || addressBtn.textContent || '')
        .replace(/^Address:\s*/i, '')
        .trim();
    } else {
      // Fallback: look for address text container
      const allTextContainers = document.querySelectorAll('div.rogA2c, div.Io6YTe, div.fontBodyMedium');
      for (const el of allTextContainers) {
        const txt = el.textContent || '';
        if (/\d+\s+[A-Za-z0-9\s]+,\s+[A-Za-z\s]+,\s+CA/i.test(txt) || /(San Francisco|San Jose|Santa Clara|Sunnyvale|Oakland|Berkeley|Sonoma|Mountain View|Palo Alto|Fremont|San Mateo)/i.test(txt)) {
          address = txt.trim();
          break;
        }
      }
    }

    // 3. Extract Category / Type
    let category = '';
    const catBtn = document.querySelector('button.DkEaL, button[jsaction*="category"], span.YhemCb');
    if (catBtn) {
      category = catBtn.textContent.trim();
    }

    return {
      name,
      address,
      category,
      id: `${name}_${address}`
    };
  }

  /**
   * Finds the best injection anchor inside Google Maps detail panel
   */
  function findInjectionAnchor() {
    // Priority 1: Right below the category/star-rating block, above action buttons
    const actionRow = document.querySelector('div.R6Erqc, div[role="region"] div.m6QErb.D5K7Pd, div.m6QErb[aria-label*="Actions"], div.dryRY');
    if (actionRow && actionRow.parentNode) {
      return { parent: actionRow.parentNode, before: actionRow };
    }

    // Priority 2: Below the main headline container
    const headline = document.querySelector('div.fontHeadlineLarge, h1.DUwDvf');
    if (headline) {
      const topContainer = headline.closest('div.TIHn2, div.m6QErb');
      if (topContainer && topContainer.nextElementSibling) {
        return { parent: topContainer.parentNode, before: topContainer.nextElementSibling };
      }
    }

    // Priority 3: First child of main pane
    const mainPane = document.querySelector('div[role="main"], div.m6QErb.W4Efsd');
    if (mainPane) {
      return { parent: mainPane, before: mainPane.firstChild };
    }

    return null;
  }

  /**
   * Renders the loading skeleton
   */
  function renderLoading(container) {
    container.innerHTML = `
      <div class="dine-card neutral">
        <div class="dine-loading-card">
          <div class="dine-spinner"></div>
          <div class="dine-loading-text">Checking Bay Area County Food Safety records...</div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the complete health inspection report card
   */
  function renderReportCard(container, report, placeInfo) {
    const isMatched = report.matched && report.latestInspection;
    const placard = report.placard || { label: 'Unknown', badgeClass: 'neutral', icon: 'ℹ️' };
    const badgeClass = placard.badgeClass || 'neutral';
    const scoreVal = report.score;

    let violationsHtml = '';
    if (isMatched && report.latestInspection) {
      const totalV = report.latestInspection.violationsCount || 0;
      const critV = report.latestInspection.criticalViolationsCount || 0;

      let pillClass = 'clean';
      let pillText = '✅ 0 Violations Observed';
      if (critV > 0) {
        pillClass = 'has-critical';
        pillText = `⚠️ ${critV} Critical Violation${critV > 1 ? 's' : ''}`;
      } else if (totalV > 0) {
        pillClass = 'has-minor';
        pillText = `ℹ️ ${totalV} Minor Item${totalV > 1 ? 's' : ''}`;
      }

      violationsHtml = `
        <div class="dine-details-section">
          <div class="dine-detail-item">
            <span class="dine-detail-label">Inspection Type:</span>
            <span class="dine-detail-value">${report.latestInspection.type}</span>
          </div>
          <div class="dine-detail-item">
            <span class="dine-detail-label">Compliance Status:</span>
            <span class="dine-violations-pill ${pillClass}">${pillText}</span>
          </div>
          ${report.latestInspection.comment ? `
            <div class="dine-comment-box">
              "${escapeHtml(report.latestInspection.comment.slice(0, 180))}${report.latestInspection.comment.length > 180 ? '...' : ''}"
            </div>
          ` : ''}
        </div>
      `;
    }

    // Historical Reports HTML
    let historyHtml = '';
    if (report.history && report.history.length > 0) {
      const historyItems = report.history.map(item => `
        <div class="dine-history-item">
          <div class="dine-history-top">
            <span class="dine-history-date">${item.date}</span>
            <span class="dine-history-result ${item.badgeClass || 'neutral'}">${item.score ? `Score: ${item.score}` : (item.status || 'Inspected')}</span>
          </div>
          <div class="dine-history-comment">${escapeHtml(item.type || 'Routine Inspection')} ${item.comment ? `• ${escapeHtml(item.comment.slice(0, 80))}` : ''}</div>
        </div>
      `).join('');

      historyHtml = `
        <button class="dine-history-toggle" id="dineHistoryToggle">
          <span>📜 Historical Reports (${report.history.length} inspections)</span>
          <span class="dine-chevron">▾</span>
        </button>
        <div class="dine-history-drawer" id="dineHistoryDrawer">
          ${historyItems}
        </div>
      `;
    }

    // Link URL: prefer deep link or portal link
    const viewRecordsUrl = report.officialDatasetUrl || report.portalUrl || report.searchDeepLink || 'https://data.sfgov.org';

    container.innerHTML = `
      <div class="dine-card ${badgeClass}">
        <div class="dine-card-inner">
          <!-- Header -->
          <div class="dine-header-row">
            <div class="dine-placard-badge ${badgeClass}">
              <span>${placard.icon || '🛡️'}</span>
              <span>${escapeHtml(placard.label)}</span>
            </div>
            ${scoreVal !== null ? `
              <div class="dine-score-badge">
                <span class="dine-score-num">${scoreVal}</span>
                <span class="dine-score-total">/100</span>
              </div>
            ` : ''}
          </div>

          <!-- Metadata -->
          <div class="dine-meta-row">
            <span class="dine-county-tag">🏛️ ${escapeHtml(report.countyName)}</span>
            <span class="dine-date-tag">${isMatched ? `Latest: ${report.latestInspection.date}` : 'Public Health Portal'}</span>
          </div>

          <!-- Details / Violations -->
          ${violationsHtml}

          <!-- History Accordion -->
          ${historyHtml}

          <!-- Footer Actions -->
          <div class="dine-footer-row">
            <a href="${viewRecordsUrl}" target="_blank" rel="noopener noreferrer" class="dine-link-btn" title="View certified official records">
              Official Health Records ↗
            </a>
            <button class="dine-refresh-btn" id="dineRefreshBtn" title="Refresh Live Data">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind Accordion Toggle
    const toggleBtn = container.querySelector('#dineHistoryToggle');
    const drawer = container.querySelector('#dineHistoryDrawer');
    if (toggleBtn && drawer) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = drawer.classList.toggle('open');
        toggleBtn.classList.toggle('open', isOpen);
      });
    }

    // Bind Refresh Action
    const refreshBtn = container.querySelector('#dineRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loadPlaceHealthData(placeInfo, true);
      });
    }
  }

  /**
   * Helper to escape HTML characters
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Fetch and render health data for a detected place
   */
  async function loadPlaceHealthData(placeInfo, bypassCache = false) {
    if (!currentContainer) return;
    renderLoading(currentContainer);

    try {
      chrome.runtime.sendMessage(
        {
          type: 'SEARCH_HEALTH_REPORT',
          payload: {
            restaurantName: placeInfo.name,
            address: placeInfo.address,
            bypassCache
          }
        },
        (response) => {
          if (!response || !response.success || !response.data) {
            currentContainer.innerHTML = `
              <div class="dine-card neutral">
                <div class="dine-card-inner">
                  <div class="dine-header-row">
                    <span class="dine-placard-badge neutral">ℹ️ Health Record Lookup</span>
                  </div>
                  <div class="dine-meta-row">
                    <span>Bay Area Health Department</span>
                  </div>
                  <div class="dine-footer-row">
                    <a href="https://www.google.com/search?q=${encodeURIComponent(placeInfo.name + ' restaurant health inspection score')}" target="_blank" class="dine-link-btn">
                      Search Public Records ↗
                    </a>
                  </div>
                </div>
              </div>
            `;
            return;
          }

          renderReportCard(currentContainer, response.data, placeInfo);
        }
      );
    } catch (err) {
      console.error('DineExpress content error:', err);
    }
  }

  /**
   * Check for place transitions and inject UI
   */
  function checkAndInject() {
    const place = extractPlaceInfo();
    if (!place) {
      if (currentContainer) {
        currentContainer.remove();
        currentContainer = null;
      }
      currentPlaceId = null;
      return;
    }

    if (place.id === currentPlaceId && currentContainer && document.body.contains(currentContainer)) {
      return; // Already injected for this place
    }

    // New place detected!
    currentPlaceId = place.id;

    // Clean up existing container if any
    const existing = document.querySelector('.dine-express-container');
    if (existing) {
      existing.remove();
    }

    const anchor = findInjectionAnchor();
    if (!anchor || !anchor.parent) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'dine-express-container';
    container.setAttribute('data-dine-place', place.id);

    if (anchor.before) {
      anchor.parent.insertBefore(container, anchor.before);
    } else {
      anchor.parent.appendChild(container);
    }

    currentContainer = container;
    loadPlaceHealthData(place);
  }

  // Setup DOM Mutation Observer to watch for place transitions in Google Maps SPA
  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      checkAndInject();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for URL / History events
    window.addEventListener('popstate', checkAndInject);
    window.addEventListener('hashchange', checkAndInject);

    // Initial check
    setTimeout(checkAndInject, 1000);
    setTimeout(checkAndInject, 2500);
  }

  // Start on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
