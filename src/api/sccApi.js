/**
 * DineExpress - Santa Clara County Health Inspection API Client
 * Datasets:
 * - Businesses: vuw7-jmjk
 * - Inspections: 2u2d-8jej
 * - Violations: wkaa-4ccv
 */

import { normalizeRestaurantName, calculateMatchScore } from './matching.js';

const SCC_BASE_URL = 'https://data.sccgov.org/resource';
const BIZ_DATASET = 'vuw7-jmjk.json';
const INSP_DATASET = '2u2d-8jej.json';
const VIOL_DATASET = 'wkaa-4ccv.json';

/**
 * Format SCC raw date string (e.g., "20260608" or "2025-08-07T00:00:00.000") to human readable format
 */
export function formatSCCDate(dateStr) {
  if (!dateStr) return 'N/A';
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Map SCC Placard code / score to standardized grade and label
 */
export function getSCCPlacardInfo(resultCode, scoreNum) {
  const code = (resultCode || '').toUpperCase();
  if (code === 'G') {
    return {
      status: 'Pass',
      badgeClass: 'pass',
      color: '#10b981',
      icon: '✅',
      label: 'Pass (Green Placard)',
      description: 'In compliance with California food safety standards.'
    };
  } else if (code === 'Y') {
    return {
      status: 'Conditional Pass',
      badgeClass: 'conditional',
      color: '#f59e0b',
      icon: '⚠️',
      label: 'Conditional Pass (Yellow Placard)',
      description: 'Major violations were observed and corrected on-site. Re-inspection required.'
    };
  } else if (code === 'R') {
    return {
      status: 'Closure',
      badgeClass: 'closure',
      color: '#ef4444',
      icon: '🚫',
      label: 'Closure / Critical Alert (Red Placard)',
      description: 'Imminent health hazard observed. Facility was closed or subject to enforcement.'
    };
  }

  // Fallback based on score if code is missing
  if (scoreNum !== null && !isNaN(scoreNum)) {
    if (scoreNum >= 90) {
      return { status: 'Pass', badgeClass: 'pass', color: '#10b981', icon: '✅', label: 'Pass', description: 'Good compliance score.' };
    } else if (scoreNum >= 75) {
      return { status: 'Conditional Pass', badgeClass: 'conditional', color: '#f59e0b', icon: '⚠️', label: 'Needs Improvement', description: 'Moderate violations noted.' };
    } else {
      return { status: 'Major Violations', badgeClass: 'closure', color: '#ef4444', icon: '🚫', label: 'Warning', description: 'Low inspection score.' };
    }
  }

  return {
    status: 'Inspected',
    badgeClass: 'neutral',
    color: '#6b7280',
    icon: 'ℹ️',
    label: 'Inspected',
    description: 'Inspection recorded on file.'
  };
}

/**
 * Query Santa Clara County for a restaurant by name and optional address
 * @param {string} restaurantName
 * @param {string} [address='']
 * @returns {Promise<object|null>}
 */
export async function querySantaClaraCounty(restaurantName, address = '') {
  try {
    const { primaryName, cleanTokens } = normalizeRestaurantName(restaurantName);
    const searchToken = cleanTokens[0] || primaryName;
    if (!searchToken) return null;

    // Search businesses with flexible query
    const whereClause = encodeURIComponent(`upper(name) like upper('%${searchToken}%')`);
    const bizUrl = `${SCC_BASE_URL}/${BIZ_DATASET}?$where=${whereClause}&$limit=15`;
    
    const bizRes = await fetch(bizUrl);
    if (!bizRes.ok) throw new Error(`SCC Business API returned ${bizRes.status}`);
    const businesses = await bizRes.json();

    if (!Array.isArray(businesses) || businesses.length === 0) {
      return null;
    }

    // Rank candidates by fuzzy name & address similarity
    const candidates = businesses.map(biz => ({
      biz,
      score: calculateMatchScore({ name: restaurantName, address }, { name: biz.name, address: `${biz.address || ''} ${biz.city || ''}` })
    }));

    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];

    if (!bestMatch || bestMatch.score < 25) {
      return null;
    }

    const matchedBiz = bestMatch.biz;
    const businessId = matchedBiz.business_id;

    // Query inspections for this business ordered by date descending
    const inspWhere = encodeURIComponent(`business_id='${businessId}'`);
    const inspUrl = `${SCC_BASE_URL}/${INSP_DATASET}?$where=${inspWhere}&$order=date%20DESC&$limit=10`;
    const inspRes = await fetch(inspUrl);
    if (!inspRes.ok) throw new Error(`SCC Inspection API returned ${inspRes.status}`);
    const inspections = await inspRes.json();

    if (!Array.isArray(inspections) || inspections.length === 0) {
      return {
        county: 'Santa Clara County',
        matched: true,
        businessName: matchedBiz.name,
        address: matchedBiz.address,
        city: matchedBiz.city,
        postalCode: matchedBiz.postal_code,
        score: null,
        status: 'Permitted',
        badgeClass: 'neutral',
        placard: { label: 'Permitted', color: '#6b7280', icon: 'ℹ️' },
        latestInspection: null,
        history: [],
        portalUrl: 'https://cpd.sccgov.org/sccdineout-mobile-app'
      };
    }

    const latest = inspections[0];
    const latestInspId = latest.inpsection_id || latest.inspection_id;
    const scoreNum = latest.score ? Number(latest.score) : null;
    const placard = getSCCPlacardInfo(latest.result, scoreNum);

    // Query violations for the latest inspection if available
    let violations = [];
    if (latestInspId) {
      try {
        const violWhere = encodeURIComponent(`inspection_id='${latestInspId}'`);
        const violUrl = `${SCC_BASE_URL}/${VIOL_DATASET}?$where=${violWhere}&$limit=20`;
        const violRes = await fetch(violUrl);
        if (violRes.ok) {
          violations = await violRes.json();
        }
      } catch (err) {
        console.warn('DineExpress: Error fetching violations', err);
      }
    }

    const criticalViolations = violations.filter(v => v.critical === true || v.critical === 'true');
    const nonCriticalViolations = violations.filter(v => v.critical !== true && v.critical !== 'true');

    // Build historical records timeline
    const history = inspections.map(insp => {
      const sNum = insp.score ? Number(insp.score) : null;
      const pInfo = getSCCPlacardInfo(insp.result, sNum);
      return {
        inspectionId: insp.inpsection_id || insp.inspection_id,
        date: formatSCCDate(insp.date),
        rawDate: insp.date,
        score: sNum,
        result: insp.result,
        status: pInfo.status,
        badgeClass: pInfo.badgeClass,
        type: insp.type || 'Routine Inspection',
        comment: insp.inspection_comment || ''
      };
    });

    return {
      county: 'Santa Clara County',
      matched: true,
      businessName: matchedBiz.name,
      address: matchedBiz.address,
      city: matchedBiz.city || 'Santa Clara County',
      postalCode: matchedBiz.postal_code,
      score: scoreNum,
      status: placard.status,
      placard: placard,
      latestInspection: {
        date: formatSCCDate(latest.date),
        rawDate: latest.date,
        type: latest.type || 'Routine Inspection',
        score: scoreNum,
        result: latest.result,
        comment: latest.inspection_comment || '',
        violationsCount: violations.length,
        criticalViolationsCount: criticalViolations.length,
        violations: violations.map(v => ({
          code: v.code,
          description: v.description,
          critical: v.critical === true || v.critical === 'true',
          comment: v.violation_comment
        }))
      },
      history,
      portalUrl: 'https://cpd.sccgov.org/sccdineout-mobile-app',
      officialDatasetUrl: `https://data.sccgov.org/resource/vuw7-jmjk?business_id=${businessId}`
    };
  } catch (error) {
    console.error('DineExpress: SCC Query failed', error);
    return null;
  }
}
