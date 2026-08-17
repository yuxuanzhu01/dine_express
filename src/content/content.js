/**
 * DineExpress - Google Maps Content Script (Compact Inline Edition)
 * Detects restaurant places and injects a sleek inline status badge and details popover.
 */

(() => {
  let currentPlaceId = null;
  let currentWrapper = null;
  let observer = null;

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
   * Determine if the place is food / dining related
   */
  function isFoodRelated(placeInfo) {
    // 1. Category check
    const cat = (placeInfo.category || '').toLowerCase();
    if (cat && FOOD_CATEGORY_KEYWORDS.some(kw => cat.includes(kw))) {
      return true;
    }

    // 2. DOM food signals check (Menu tab, Order online button, Dine-in tags)
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

    // 3. Name keywords check
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
    // 1. Right after the category line (e.g. "Chinese restaurant · ♿")
    const catBtn = document.querySelector('button.DkEaL, button[jsaction*="category"], span.YhemCb');
    if (catBtn) {
      const catContainer = catBtn.closest('div.fontBodyMedium, div.SKNSIb, div.m6QErb');
      if (catContainer && catContainer.parentNode) {
        return { parent: catContainer.parentNode, before: catContainer.nextElementSibling };
      }
    }

    // 2. Right above Overview/Menu tab row
    const tabRow = document.querySelector('div.R6Erqc, div[role="tablist"], div.m6QErb.D5K7Pd');
    if (tabRow && tabRow.parentNode) {
      return { parent: tabRow.parentNode, before: tabRow };
    }

    // 3. Below headline container
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
   * Render loading state
   */
  function renderLoading(wrapper) {
    wrapper.innerHTML = `
      <div class="dine-inline-bar">
        <div class="dine-inline-loading">
          <div class="dine-spinner-mini"></div>
          <span>Checking Health Score...</span>
        </div>
      </div>
    `;
  }

  /**
   * Render compact inline badge and details popover
   */
  function renderBadge(wrapper, report) {
    const isMatched = report.matched && report.latestInspection;
    const placard = report.placard || { label: 'Inspected', badgeClass: 'neutral', icon: 'ℹ️' };
    const badgeClass = placard.badgeClass || 'neutral';
    const scoreText = report.score !== null ? ` ${report.score}` : '';
    const statusLabel = report.status || placard.label || 'Pass';
    const viewUrl = report.officialDatasetUrl || report.portalUrl || report.searchDeepLink || 'https://data.sfgov.org';

    // Status icon
    let statusIcon = '🟢';
    if (badgeClass === 'conditional') statusIcon = '🟡';
    else if (badgeClass === 'closure') statusIcon = '🔴';
    else if (badgeClass === 'neutral') statusIcon = '🏛️';

    let historyListHtml = '';
    if (report.history && report.history.length > 0) {
      historyListHtml = report.history.slice(0, 5).map(h => `
        <div class="dine-popover-history-item">
          <span>${h.date}</span>
          <span style="font-weight: 600;">${h.score ? `Score: ${h.score}` : (h.status || 'Inspected')}</span>
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
        <button class="dine-details-trigger" id="dineDetailsToggle" title="View inspection details">
          <span>Details</span>
          <span class="dine-chevron">▾</span>
        </button>

        <!-- Official Link -->
        <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="dine-official-link" title="Open official health records">
          Official Records ↗
        </a>
      </div>

      <!-- Popover Drawer -->
      <div class="dine-popover" id="dinePopover">
        <div class="dine-popover-header">
          <span class="dine-popover-county">🏛️ ${escapeHtml(report.countyName)}</span>
          <span class="dine-popover-date">${isMatched ? `Latest: ${report.latestInspection.date}` : 'Health Portal'}</span>
        </div>

        <div class="dine-popover-body">
          ${isMatched && report.latestInspection ? `
            <div class="dine-popover-row">
              <span class="dine-popover-label">Inspection Type:</span>
              <span class="dine-popover-val">${escapeHtml(report.latestInspection.type)}</span>
            </div>
            <div class="dine-popover-row">
              <span class="dine-popover-label">Violations:</span>
              <span class="dine-popover-val" style="color: ${report.latestInspection.criticalViolationsCount > 0 ? '#dc2626' : '#059669'}">
                ${report.latestInspection.criticalViolationsCount > 0 ? `⚠️ ${report.latestInspection.criticalViolationsCount} Critical` : '✅ 0 Critical'}
                ${report.latestInspection.violationsCount > 0 ? ` (${report.latestInspection.violationsCount} total)` : ''}
              </span>
            </div>
            ${report.latestInspection.comment ? `
              <div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 6px; line-height: 1.3;">
                "${escapeHtml(report.latestInspection.comment.slice(0, 140))}${report.latestInspection.comment.length > 140 ? '...' : ''}"
              </div>
            ` : ''}
          ` : `
            <div style="color: #64748b; font-size: 11px;">
              Inspection records are maintained by the ${escapeHtml(report.countyName)} Environmental Health department.
            </div>
          `}
        </div>

        ${historyListHtml ? `
          <div class="dine-popover-history">
            <div class="dine-history-title">📜 Past Inspections</div>
            ${historyListHtml}
          </div>
        ` : ''}
      </div>
    `;

    // Toggle Popover
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
   * Load health data for place
   */
  function loadHealthData(placeInfo) {
    if (!currentWrapper) return;
    renderLoading(currentWrapper);

    chrome.runtime.sendMessage(
      {
        type: 'SEARCH_HEALTH_REPORT',
        payload: {
          restaurantName: placeInfo.name,
          address: placeInfo.address,
          bypassCache: false
        }
      },
      (response) => {
        if (!response || !response.success || !response.data) {
          if (currentWrapper) currentWrapper.remove();
          return;
        }

        renderBadge(currentWrapper, response.data);
      }
    );
  }

  /**
   * Check page and inject inline badge if restaurant
   */
  function checkAndInject() {
    const place = extractPlaceInfo();
    if (!place) {
      if (currentWrapper) {
        currentWrapper.remove();
        currentWrapper = null;
      }
      currentPlaceId = null;
      return;
    }

    // Check if food / restaurant related
    if (!isFoodRelated(place)) {
      if (currentWrapper) {
        currentWrapper.remove();
        currentWrapper = null;
      }
      currentPlaceId = null;
      return; // DO NOT SHOW FOR NON-RESTAURANTS
    }

    if (place.id === currentPlaceId && currentWrapper && document.body.contains(currentWrapper)) {
      return;
    }

    currentPlaceId = place.id;

    // Clean up old badge
    const existing = document.querySelector('.dine-inline-wrapper');
    if (existing) {
      existing.remove();
    }

    const anchor = findAnchor();
    if (!anchor || !anchor.parent) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'dine-inline-wrapper';
    wrapper.setAttribute('data-dine-place', place.id);

    if (anchor.before) {
      anchor.parent.insertBefore(wrapper, anchor.before);
    } else {
      anchor.parent.appendChild(wrapper);
    }

    currentWrapper = wrapper;
    loadHealthData(place);
  }

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      checkAndInject();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('popstate', checkAndInject);
    window.addEventListener('hashchange', checkAndInject);

    setTimeout(checkAndInject, 600);
    setTimeout(checkAndInject, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
