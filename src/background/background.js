/**
 * DineExpress - Background Service Worker
 * Handles caching, county API requests, and message passing.
 */

import { searchRestaurantHealthReport } from '../api/unifiedService.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours cache TTL

/**
 * Generates a consistent cache key
 */
function getCacheKey(name, address = '', countyId = '') {
  const clean = `${name || ''}|${address || ''}|${countyId || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return `dine_cache_${clean}`;
}

/**
 * Retrieve cached report from chrome.storage.local
 */
async function getCachedReport(cacheKey) {
  try {
    const result = await chrome.storage.local.get([cacheKey]);
    if (result && result[cacheKey]) {
      const entry = result[cacheKey];
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }
  } catch (err) {
    console.warn('DineExpress: Cache read error', err);
  }
  return null;
}

/**
 * Store report in chrome.storage.local
 */
async function setCachedReport(cacheKey, data) {
  try {
    await chrome.storage.local.set({
      [cacheKey]: {
        timestamp: Date.now(),
        data
      }
    });
  } catch (err) {
    console.warn('DineExpress: Cache write error', err);
  }
}

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_HEALTH_REPORT') {
    (async () => {
      try {
        const { restaurantName, address, explicitCountyId, bypassCache } = message.payload;
        const cacheKey = getCacheKey(restaurantName, address, explicitCountyId);

        if (!bypassCache) {
          const cached = await getCachedReport(cacheKey);
          if (cached) {
            sendResponse({ success: true, fromCache: true, data: cached });
            return;
          }
        }

        const report = await searchRestaurantHealthReport(restaurantName, address, explicitCountyId);
        if (report && report.success) {
          await setCachedReport(cacheKey, report);
        }

        sendResponse({ success: true, fromCache: false, data: report });
      } catch (err) {
        console.error('DineExpress Background error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'CLEAR_CACHE') {
    (async () => {
      try {
        const allKeys = await chrome.storage.local.get(null);
        const dineKeys = Object.keys(allKeys).filter(k => k.startsWith('dine_cache_'));
        if (dineKeys.length > 0) {
          await chrome.storage.local.remove(dineKeys);
        }
        sendResponse({ success: true, clearedCount: dineKeys.length });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'GET_STATS') {
    (async () => {
      try {
        const all = await chrome.storage.local.get(null);
        const cacheEntries = Object.keys(all).filter(k => k.startsWith('dine_cache_'));
        sendResponse({
          success: true,
          cachedItemsCount: cacheEntries.length
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
