/**
 * DineExpress - Google Maps Content Script (Strict Singleton Edition)
 * Ensures EXACTLY ONE badge is ever displayed per view.
 * Eliminates duplicate async injections through debouncing, in-flight locks, and DOM cleanup.
 */

(() => {
  let inFlightPlaceId = null;
  let lastInjectedPlaceId = null;
  let debounceTimer = null;
  let observer = null;

  const BADGE_CONTAINER_ID = 'dine-express-single-badge';

  const FOOD_CATEGORY_KEYWORDS = [
    'restaurant', 'cafe', 'café', 'bakery', 'bar', 'pub', 'grill', 'bbq', 'barbecue',
    'pizza', 'pizzeria', 'taco', 'taqueria', 'sushi', 'ramen', 'noodle', 'diner',
    'bistro', 'buffet', 'ice cream', 'frozen yogurt', 'coffee', 'tea', 'boba',
    'bubble tea', 'dessert', 'deli', 'delicatessen', 'sandwich', 'fast food',
    'seafood', 'steak', 'steakhouse', 'brewery', 'winery', 'gastropub', 'lounge',
    'cantina', 'food court', 'food truck', 'eatery', 'kitchen', 'pot', 'hot pot',
    'cantonese', 'sichuan', 'dim sum', 'chinese', 'korean', 'japanese', 'mexican',
    'italian', 'thai', 'vietnamese', 'indian', 'american', 'mediterranean', 'greek',
    'french', 'spanish', 'persian', 'ethiopian', 'caribbean', 'hawaiian', 'poke',
    'donut', 'doughnut', 'bagel', 'burger', 'hamburger', 'wings', 'chicken',
    'creperie', 'brunch', 'breakfast', 'caterer', 'catering', 'supermarket', 'grocery',
    'food'
  ];

  /**
   * Remove any and all existing DineExpress badges from the page
   */
  function removeAllBadges() {
    document.querySelectorAll(`.${BADGE_CONTAINER_ID}, #${BADGE_CONTAINER_ID}, .dine-inline-wrapper`).forEach(el => el.remove());
  }

  /**
   * Determine if the place is food / dining related
   */
  function isFoodRelated(placeInfo) {
    const cat = (placeInfo.category || '').toLowerCase();
    if (cat && FOOD_CATEGORY_KEYWORDS.some(kw => cat.includes(kw))) {
      return true;
    }

    const menuTab = document.querySelector('button[aria-label*="Menu"], button[aria-label*="menu"], [data-tab-index="1"]');
    if (menuTab && /menu/i.test(menuTab.textContent || '')) {
      return true;
    }

    const orderBtn = document.querySelector('button[aria-label*="Order"], a[aria-label*="Order"], [data-item-id*="order"], button.g88MCb');
    if (orderBtn && /order/i.test(orderBtn.textContent || '')) {
      return true;
    }

    const serviceTags = document.querySelectorAll('div.E02Zkc, div.LTs0Rc, div.fontBodyMedium, span');
    for (const el of serviceTags) {
      const txt = (el.textContent || '').toLowerCase();
      if (txt.includes('dine-in') || txt.includes('takeout') || txt.includes('delivery')) {
        return true;
      }
    }

    const name = (placeInfo.name || '').toLowerCase();
    if (FOOD_CATEGORY_KEYWORDS.some(kw => name.includes(kw))) {
      return true;
    }

    return false;
  }

  /**
   * Extract place details from Google Maps DOM
   */
  function extractPlaceInfo() {
    const titleEl = document.querySelector('h1.DUwDvf, div[role="main"] h1, h1.fontHeadlineLarge, div.fontHeadlineLarge');
    if (!titleEl || !titleEl.textContent.trim()) {
      return null;
    }
    const name = titleEl.textContent.trim();

    let address = '';
    const addressBtn = document.querySelector('button[data-item-id="address"], button[aria-label*="Address:"], [data-tooltip="Copy address"]');
    if (addressBtn) {
      address = (addressBtn.getAttribute('aria-label') || addressBtn.textContent || '')
        .replace(/^Address:\s*/i, '')
        .trim();
    } else {
      const allTextContainers = document.querySelectorAll('div.rogA2c, div.Io6YTe, div.fontBodyMedium');
      for (const el of allTextContainers) {
        const txt = el.textContent || '';
        if (/\d+\s+[A-Za-z0-9\s]+,\s+[A-Za-z\s]+,\s+CA/i.test(txt) || /(San Francisco|San Jose|Santa Clara|Sunnyvale|Oakland|Berkeley|Sonoma|Mountain View|Palo Alto|Fremont|San Mateo)/i.test(txt)) {
          address = txt.trim();
          break;
        }
      }
    }

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
   * Find injection anchor right under category / rating row in the whitespace
   */
  function findAnchor() {
    const catBtn = document.querySelector('button.DkEaL, button[jsaction*="category"], span.YhemCb');
    if (catBtn) {
      const catContainer = catBtn.closest('div.fontBodyMedium, div.SKNSIb, div.m6QErb');
      if (catContainer && catContainer.parentNode) {
        return { parent: catContainer.parentNode, before: catContainer.nextElementSibling };
      }
    }

    const tabRow = document.querySelector('div.R6Erqc, div[role="tablist"], div.m6QErb.D5K7Pd');
    if (tabRow && tabRow.parentNode) {
      return { parent: tabRow.parentNode, before: tabRow };
    }

    const headline = document.querySelector('h1.DUwDvf, div.fontHeadlineLarge');
    if (headline) {
      const topContainer = headline.closest('div.TIHn2, div.m6QErb');
      if (topContainer && topContainer.nextElementSibling) {
        return { parent: topContainer.parentNode, before: topContainer.nextElementSibling };
      }
    }

    return null;
  }

  /**
   * Render single verified inline badge and details popover
   */
  function renderBadge(wrapper, report) {
    const placard = report.placard || { label: 'Pass', badgeClass: 'pass', icon: '🟢' };
    const badgeClass = placard.badgeClass || 'pass';
    const scoreText = report.score !== null ? ` ${report.score}` : '';
    const statusLabel = report.status || placard.label || 'Pass';
    const viewUrl = report.officialDatasetUrl || report.portalUrl || report.searchDeepLink || 'https://data.sfgov.org';
    const pdfUrl = report.reportPdfUrl || viewUrl;

    let statusIcon = '🟢';
    if (badgeClass === 'conditional') statusIcon = '🟡';
    else if (badgeClass === 'closure') statusIcon = '🔴';

    let violationsHtml = '';
    const viols = report.latestInspection?.violations || [];
    if (viols.length > 0) {
      const violItems = viols.map(v => `
        <div class="dine-violation-item">
          <div class="dine-violation-top">
            <span class="dine-viol-badge ${v.critical ? 'critical' : 'minor'}">${v.critical ? 'Critical' : 'Minor'} ${escapeHtml(v.code || '')}</span>
            <span class="dine-viol-title">${escapeHtml(v.description || 'Violation recorded')}</span>
          </div>
          ${v.comment ? `<div class="dine-viol-desc">"${escapeHtml(v.comment.slice(0, 150))}${v.comment.length > 150 ? '...' : ''}"</div>` : ''}
        </div>
      `).join('');

      violationsHtml = `
        <div class="dine-violations-box">
          <div class="dine-violations-heading">
            <span>⚠️ Observed Violations (${viols.length})</span>
            <span style="font-size: 10px; color: ${report.latestInspection.criticalViolationsCount > 0 ? '#b91c1c' : '#047857'}">
              ${report.latestInspection.criticalViolationsCount || 0} Critical
            </span>
          </div>
          ${violItems}
        </div>
      `;
    } else {
      violationsHtml = `
        <div class="dine-violations-box" style="background: #f0fdf4; border-color: #bbf7d0;">
          <div style="color: #166534; font-weight: 600; font-size: 11px;">
            ✅ Clean Inspection — Zero Violations Recorded
          </div>
        </div>
      `;
    }

    let historyListHtml = '';
    if (report.history && report.history.length > 0) {
      historyListHtml = report.history.slice(0, 5).map(h => `
        <div class="dine-popover-history-item">
          <span>${h.date}</span>
          <span style="font-weight: 600; color: ${h.badgeClass === 'closure' ? '#b91c1c' : (h.badgeClass === 'conditional' ? '#b45309' : '#047857')};">
            ${h.score ? `Score: ${h.score}` : (h.status || 'Inspected')}
          </span>
        </div>
      `).join('');
    }

    wrapper.innerHTML = `
      <div class="dine-inline-bar">
        <!-- Status & Score Chip -->
        <span class="dine-status-pill ${badgeClass}">
          <span>${statusIcon}</span>
          <span>${escapeHtml(statusLabel)}</span>
          ${scoreText ? `<span class="dine-score-tag">${scoreText}</span>` : ''}
        </span>

        <!-- More Details Trigger -->
        <button class="dine-details-trigger" id="dineDetailsToggle" title="View detailed violations & report">
          <span>Details</span>
          <span class="dine-chevron">▾</span>
        </button>

        <!-- Official Link -->
        <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="dine-official-link" title="Open official health records">
          Official Records ↗
        </a>
      </div>

      <!-- Rich Details Popover -->
      <div class="dine-popover" id="dinePopover">
        <div class="dine-popover-header">
          <div>
            <div class="dine-popover-county">🏛️ ${escapeHtml(report.countyName)}</div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 1px;">
              ${escapeHtml(report.businessName || '')} ${report.address ? `• ${escapeHtml(report.address)}` : ''}
            </div>
          </div>
          <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" class="dine-pdf-btn" title="View or Print Certified County Inspection Report / PDF">
            📄 Official PDF ↗
          </a>
        </div>

        <div class="dine-popover-body">
          ${report.latestInspection ? `
            <div class="dine-popover-row">
              <span class="dine-popover-label">Inspection Date:</span>
              <span class="dine-popover-val">${report.latestInspection.date}</span>
            </div>
            <div class="dine-popover-row">
              <span class="dine-popover-label">Inspection Type:</span>
              <span class="dine-popover-val">${escapeHtml(report.latestInspection.type)}</span>
            </div>
            ${report.score !== null ? `
              <div class="dine-popover-row">
                <span class="dine-popover-label">Compliance Score:</span>
                <span class="dine-popover-val"><strong>${report.score} / 100</strong></span>
              </div>
            ` : ''}
          ` : ''}

          <!-- Violations Breakdown -->
          ${violationsHtml}
        </div>

        <!-- History Timeline -->
        ${historyListHtml ? `
          <div class="dine-popover-history">
            <div class="dine-history-title">📜 Past Inspections</div>
            ${historyListHtml}
          </div>
        ` : ''}

        <!-- Legal Disclaimer & Discrepancy Reporting -->
        <div class="dine-popover-legal">
          <div>⚖️ <em>Informational public data aggregate. Official county records govern. Provided AS IS.</em></div>
          <div style="margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
            <a href="https://github.com/yuxuanzhu0214/dine_express/issues/new?title=Data+Mismatch+Report:+${encodeURIComponent(report.businessName || '')}" target="_blank" rel="noopener noreferrer" style="color: #64748b; text-decoration: underline; font-size: 9px;">
              🚩 Flag Discrepancy / Report Mismatch
            </a>
            <a href="https://github.com/yuxuanzhu0214/dine_express/blob/main/DISCLAIMER.md" target="_blank" rel="noopener noreferrer" style="color: #64748b; text-decoration: underline; font-size: 9px;">
              Legal Terms ↗
            </a>
          </div>
        </div>
      </div>
    `;

    const trigger = wrapper.querySelector('#dineDetailsToggle');
    const popover = wrapper.querySelector('#dinePopover');
    if (trigger && popover) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = popover.classList.toggle('open');
        trigger.classList.toggle('active', isOpen);
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Main inspection logic with strict debounce and singleton enforcement
   */
  function checkAndInjectNow() {
    const place = extractPlaceInfo();

    // 1. If not on a valid place page, remove all badges and reset
    if (!place) {
      removeAllBadges();
      inFlightPlaceId = null;
      lastInjectedPlaceId = null;
      return;
    }

    // 2. If not food related, remove all badges and exit
    if (!isFoodRelated(place)) {
      removeAllBadges();
      inFlightPlaceId = null;
      lastInjectedPlaceId = null;
      return;
    }

    // 3. If badge is already rendered and valid in DOM for this exact place, do nothing
    const existingBadge = document.getElementById(BADGE_CONTAINER_ID);
    if (existingBadge && lastInjectedPlaceId === place.id && document.body.contains(existingBadge)) {
      return;
    }

    // 4. If query for this place is already in-flight, do not send duplicate requests
    if (inFlightPlaceId === place.id) {
      return;
    }

    // Mark query as in-flight
    inFlightPlaceId = place.id;

    // Send query to background service worker
    chrome.runtime.sendMessage(
      {
        type: 'SEARCH_HEALTH_REPORT',
        payload: {
          restaurantName: place.name,
          address: place.address,
          bypassCache: false
        }
      },
      (response) => {
        // Reset in-flight lock for this request
        if (inFlightPlaceId === place.id) {
          inFlightPlaceId = null;
        }

        // Verify current place hasn't changed while request was in transit
        const currentPlace = extractPlaceInfo();
        if (!currentPlace || currentPlace.id !== place.id) {
          return;
        }

        // Strict Check: If no verified record exists, ensure no badges exist
        if (!response || !response.success || !response.data || !response.data.matched || !response.data.latestInspection) {
          removeAllBadges();
          lastInjectedPlaceId = null;
          return;
        }

        // Find insertion point
        const anchor = findAnchor();
        if (!anchor || !anchor.parent) {
          return;
        }

        // ABSOLUTE SINGLETON GUARANTEE: Remove any existing badges before creating the single badge
        removeAllBadges();

        const wrapper = document.createElement('div');
        wrapper.id = BADGE_CONTAINER_ID;
        wrapper.className = 'dine-inline-wrapper';
        wrapper.setAttribute('data-dine-place', place.id);

        if (anchor.before) {
          anchor.parent.insertBefore(wrapper, anchor.before);
        } else {
          anchor.parent.appendChild(wrapper);
        }

        lastInjectedPlaceId = place.id;
        renderBadge(wrapper, response.data);
      }
    );
  }

  /**
   * Debounced observer entry point (coalesces burst mutations)
   */
  function scheduleCheck() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(checkAndInjectNow, 200);
  }

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      scheduleCheck();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('popstate', scheduleCheck);
    window.addEventListener('hashchange', scheduleCheck);

    setTimeout(scheduleCheck, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
