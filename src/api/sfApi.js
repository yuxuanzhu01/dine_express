/**
 * DineExpress - San Francisco Health Inspection API Client
 * Datasets:
 * - 2024-Present: tvy3-wexg.json (DataSF)
 * - Historical 2016-2019: pyih-qa8i.json (DataSF)
 */

import { normalizeRestaurantName, calculateMatchScore } from './matching.js';

const SF_BASE_URL = 'https://data.sfgov.org/resource';
const CURRENT_DATASET = 'tvy3-wexg.json';
const HISTORICAL_DATASET = 'pyih-qa8i.json';

/**
 * Format SF ISO date string to human readable format
 */
export function formatSFDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Map SF Facility Rating Status to standardized placard
 */
export function getSFPlacardInfo(statusStr, scoreNum) {
  const s = (statusStr || '').toLowerCase();
  if (s.includes('pass') && !s.includes('conditional')) {
    return {
      status: 'Pass',
      badgeClass: 'pass',
      color: '#10b981',
      icon: '✅',
      label: 'Pass (Green)',
      description: 'Satisfactory food safety practices in compliance with SF Public Health Code.'
    };
  } else if (s.includes('conditional') || s.includes('improvement')) {
    return {
      status: 'Conditional Pass',
      badgeClass: 'conditional',
      color: '#f59e0b',
      icon: '⚠️',
      label: 'Conditional Pass (Yellow)',
      description: 'Violations observed requiring corrective action and reinspection.'
    };
  } else if (s.includes('close') || s.includes('closed') || s.includes('red') || s.includes('suspension')) {
    return {
      status: 'Closure',
      badgeClass: 'closure',
      color: '#ef4444',
      icon: '🚫',
      label: 'Closure / Suspension (Red)',
      description: 'Health permit suspended or closure ordered.'
    };
  }

  // Fallback on score if available
  if (scoreNum !== null && !isNaN(scoreNum)) {
    if (scoreNum >= 90) return { status: 'Pass', badgeClass: 'pass', color: '#10b981', icon: '✅', label: 'Grade A', description: 'Score >= 90.' };
    if (scoreNum >= 75) return { status: 'Conditional Pass', badgeClass: 'conditional', color: '#f59e0b', icon: '⚠️', label: 'Grade B', description: 'Score 75-89.' };
    return { status: 'Major Violations', badgeClass: 'closure', color: '#ef4444', icon: '🚫', label: 'Grade C / Warning', description: 'Score < 75.' };
  }

  return {
    status: statusStr || 'Inspected',
    badgeClass: 'neutral',
    color: '#6b7280',
    icon: 'ℹ️',
    label: statusStr || 'Inspected',
    description: 'Inspection record available.'
  };
}

/**
 * Query San Francisco County for a restaurant by name and optional address
 * @param {string} restaurantName
 * @param {string} [address='']
 * @returns {Promise<object|null>}
 */
export async function querySanFranciscoCounty(restaurantName, address = '') {
  try {
    const { primaryName, cleanTokens } = normalizeRestaurantName(restaurantName);
    const searchToken = cleanTokens[0] || primaryName;
    if (!searchToken) return null;

    // Search 2024-Present dataset
    const whereClause = encodeURIComponent(`upper(dba) like upper('%${searchToken}%')`);
    const url = `${SF_BASE_URL}/${CURRENT_DATASET}?$where=${whereClause}&$order=inspection_date%20DESC&$limit=20`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SF API returned ${res.status}`);
    const records = await res.json();

    if (!Array.isArray(records) || records.length === 0) {
      // Try historical dataset fallback
      return await querySFHistorical(restaurantName, address);
    }

    // Group records by DBA / Address to separate multiple locations
    const grouped = new Map();
    for (const rec of records) {
      const key = `${rec.dba}_${rec.street_address || ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(rec);
    }

    // Rank grouped locations
    const candidates = [];
    for (const [key, list] of grouped.entries()) {
      const sample = list[0];
      const matchScore = calculateMatchScore(
        { name: restaurantName, address },
        { name: sample.dba, address: sample.street_address }
      );
      candidates.push({ key, list, sample, score: matchScore });
    }

    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];

    if (!bestMatch || bestMatch.score < 25) {
      return await querySFHistorical(restaurantName, address);
    }

    const matchedList = bestMatch.list;
    const latest = matchedList[0];
    const status = latest.facility_rating_status || 'Pass';
    const violationCount = latest.violation_count ? Number(latest.violation_count) : 0;
    const placard = getSFPlacardInfo(status, null);

    // Parse violation codes text if present
    const rawViolations = latest.violation_codes ? latest.violation_codes.split(', ') : [];
    const violations = rawViolations.map(codeStr => {
      const isCritical = /113952|113953|113996|114259|temperature|hands|vermin|rodent/i.test(codeStr);
      return {
        description: codeStr,
        critical: isCritical,
        code: codeStr.split(' - ')[0] || ''
      };
    });

    const criticalViolations = violations.filter(v => v.critical);

    const history = matchedList.map(rec => {
      const pInfo = getSFPlacardInfo(rec.facility_rating_status, null);
      const vCount = rec.violation_count ? Number(rec.violation_count) : 0;
      return {
        inspectionId: rec.permit_number || '',
        date: formatSFDate(rec.inspection_date),
        rawDate: rec.inspection_date,
        score: null,
        status: pInfo.status,
        badgeClass: pInfo.badgeClass,
        type: rec.permit_type ? `Permit: ${rec.permit_type}` : 'Routine Inspection',
        comment: vCount > 0 ? `${vCount} violations observed.` : 'No violations observed.'
      };
    });

    return {
      county: 'San Francisco County',
      matched: true,
      businessName: latest.dba,
      address: latest.street_address,
      city: 'San Francisco',
      postalCode: '941XX',
      score: null,
      status: placard.status,
      placard: placard,
      latestInspection: {
        date: formatSFDate(latest.inspection_date),
        rawDate: latest.inspection_date,
        type: latest.permit_type ? `Facility Type: ${latest.permit_type}` : 'Routine Inspection',
        score: null,
        result: latest.facility_rating_status,
        comment: violationCount > 0 ? `${violationCount} violations recorded during inspection.` : 'Passed inspection with zero violations.',
        violationsCount: violationCount,
        criticalViolationsCount: criticalViolations.length,
        violations: violations
      },
      history,
      portalUrl: 'https://data.sfgov.org/Health/Health-Inspection-Scores-2024-Present/g8m3-pdis',
      officialDatasetUrl: `https://data.sfgov.org/Health/Health-Inspection-Scores-2024-Present/g8m3-pdis/data?query=${encodeURIComponent(latest.dba)}`
    };
  } catch (error) {
    console.error('DineExpress: SF Query failed', error);
    return null;
  }
}

/**
 * Historical fallback search on older SF LIVES dataset
 */
async function querySFHistorical(restaurantName, address) {
  try {
    const { primaryName, cleanTokens } = normalizeRestaurantName(restaurantName);
    const searchToken = cleanTokens[0] || primaryName;
    if (!searchToken) return null;

    const whereClause = encodeURIComponent(`upper(business_name) like upper('%${searchToken}%')`);
    const url = `${SF_BASE_URL}/${HISTORICAL_DATASET}?$where=${whereClause}&$order=inspection_date%20DESC&$limit=10`;
    
    const res = await fetch(url);
    if (!res.ok) return null;
    const records = await res.json();
    if (!Array.isArray(records) || records.length === 0) return null;

    const latest = records[0];
    const scoreNum = latest.inspection_score ? Number(latest.inspection_score) : null;
    const placard = getSFPlacardInfo(null, scoreNum);

    return {
      county: 'San Francisco County',
      matched: true,
      businessName: latest.business_name,
      address: latest.business_address,
      city: 'San Francisco',
      postalCode: latest.business_postal_code || '941XX',
      score: scoreNum,
      status: placard.status,
      placard: placard,
      latestInspection: {
        date: formatSFDate(latest.inspection_date),
        rawDate: latest.inspection_date,
        type: latest.inspection_type || 'Routine Inspection',
        score: scoreNum,
        result: latest.inspection_score ? `Score: ${latest.inspection_score}` : 'Inspected',
        comment: latest.violation_description || 'Historical record.',
        violationsCount: records.filter(r => r.violation_description).length,
        criticalViolationsCount: records.filter(r => (r.risk_category || '').toLowerCase().includes('high')).length,
        violations: records.filter(r => r.violation_description).map(r => ({
          description: r.violation_description,
          critical: (r.risk_category || '').toLowerCase().includes('high'),
          code: r.violation_id || ''
        }))
      },
      history: records.map(r => ({
        inspectionId: r.inspection_id || '',
        date: formatSFDate(r.inspection_date),
        score: r.inspection_score ? Number(r.inspection_score) : null,
        status: getSFPlacardInfo(null, r.inspection_score ? Number(r.inspection_score) : null).status,
        badgeClass: getSFPlacardInfo(null, r.inspection_score ? Number(r.inspection_score) : null).badgeClass,
        type: r.inspection_type || 'Routine Inspection',
        comment: r.violation_description || ''
      })),
      portalUrl: 'https://data.sfgov.org/Health/Health-Inspection-Scores-2024-Present/g8m3-pdis',
      officialDatasetUrl: `https://data.sfgov.org/resource/pyih-qa8i?business_id=${latest.business_id}`
    };
  } catch (err) {
    return null;
  }
}
