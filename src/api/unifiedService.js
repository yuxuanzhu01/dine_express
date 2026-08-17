/**
 * DineExpress - Unified Bay Area Food Safety & Inspection Service
 * Coordinates multi-county queries, fuzzy matching, fallback strategies, and official portal deep-linking.
 */

import { BAY_AREA_COUNTIES, detectCounty } from './countyInfo.js';
import { querySantaClaraCounty } from './sccApi.js';
import { querySanFranciscoCounty } from './sfApi.js';
import { querySonomaCounty } from './sonomaApi.js';
import { normalizeRestaurantName } from './matching.js';

/**
 * Searches health inspection scores and reports for any Bay Area restaurant
 * @param {string} restaurantName Name of the establishment (e.g. "Master Oh 오선생", "Tartine Bakery")
 * @param {string} [address=''] Full or partial address (e.g. "1484 Halford Ave, Santa Clara, CA 95051")
 * @param {string} [explicitCountyId=''] Optional manual county override
 * @returns {Promise<object>} Complete health inspection report object
 */
export async function searchRestaurantHealthReport(restaurantName, address = '', explicitCountyId = '') {
  if (!restaurantName) {
    return {
      success: false,
      error: 'Restaurant name is required'
    };
  }

  // 1. Identify Target County
  let detectedCounty = explicitCountyId ? Object.values(BAY_AREA_COUNTIES).find(c => c.id === explicitCountyId) : null;
  if (!detectedCounty) {
    detectedCounty = detectCounty(address) || detectCounty(restaurantName);
  }

  const { primaryName } = normalizeRestaurantName(restaurantName);

  // 2. Query County APIs based on detected county
  let result = null;

  if (detectedCounty) {
    if (detectedCounty.id === BAY_AREA_COUNTIES.SANTA_CLARA.id) {
      result = await querySantaClaraCounty(restaurantName, address);
    } else if (detectedCounty.id === BAY_AREA_COUNTIES.SAN_FRANCISCO.id) {
      result = await querySanFranciscoCounty(restaurantName, address);
    } else if (detectedCounty.id === BAY_AREA_COUNTIES.SONOMA.id) {
      result = await querySonomaCounty(restaurantName, address);
    }
  }

  // 3. Fallback: If no direct match in detected county (or county is unknown/other Bay Area), try parallel lookups
  if (!result || !result.matched) {
    const [sccRes, sfRes, sonomaRes] = await Promise.allSettled([
      querySantaClaraCounty(restaurantName, address),
      querySanFranciscoCounty(restaurantName, address),
      querySonomaCounty(restaurantName, address)
    ]);

    if (sccRes.status === 'fulfilled' && sccRes.value && sccRes.value.matched) {
      result = sccRes.value;
      detectedCounty = BAY_AREA_COUNTIES.SANTA_CLARA;
    } else if (sfRes.status === 'fulfilled' && sfRes.value && sfRes.value.matched) {
      result = sfRes.value;
      detectedCounty = BAY_AREA_COUNTIES.SAN_FRANCISCO;
    } else if (sonomaRes.status === 'fulfilled' && sonomaRes.value && sonomaRes.value.matched) {
      result = sonomaRes.value;
      detectedCounty = BAY_AREA_COUNTIES.SONOMA;
    }
  }

  // 4. If record found in live API, return standard matched report
  if (result && result.matched) {
    return {
      success: true,
      matched: true,
      countyId: detectedCounty ? detectedCounty.id : 'unknown',
      countyName: result.county || (detectedCounty ? detectedCounty.name : 'Bay Area'),
      businessName: result.businessName,
      address: result.address,
      city: result.city,
      score: result.score,
      status: result.status,
      placard: result.placard,
      latestInspection: result.latestInspection,
      history: result.history || [],
      portalUrl: result.portalUrl || (detectedCounty ? detectedCounty.portalUrl : 'https://data.sfgov.org'),
      officialDatasetUrl: result.officialDatasetUrl,
      queryName: restaurantName,
      queryAddress: address
    };
  }

  // 5. If not found in live API or belongs to non-API county (e.g. San Mateo, Alameda, Contra Costa, Marin, Solano, Napa)
  const countyObj = detectedCounty || BAY_AREA_COUNTIES.SANTA_CLARA;
  const searchDeepLink = countyObj.searchUrlBuilder(primaryName || restaurantName);

  return {
    success: true,
    matched: false,
    countyId: countyObj.id,
    countyName: countyObj.name,
    businessName: primaryName || restaurantName,
    address: address,
    city: countyObj.cities[0] || 'Bay Area',
    score: null,
    status: 'Manual Lookup Available',
    placard: {
      status: 'Lookup Online',
      badgeClass: 'neutral',
      color: '#64748b',
      icon: '🏛️',
      label: `${countyObj.shortName} Health Portal`,
      description: `Official health inspections for ${countyObj.name} are available on their public portal.`
    },
    latestInspection: null,
    history: [],
    portalUrl: countyObj.portalUrl,
    officialDatasetUrl: searchDeepLink,
    searchDeepLink: searchDeepLink,
    portalName: countyObj.portalName,
    queryName: restaurantName,
    queryAddress: address
  };
}
