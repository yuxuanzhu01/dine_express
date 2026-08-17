/**
 * DineExpress - San Francisco Health Inspection API Client
 * Datasets:
 * - 2024-Present: tvy3-wexg.json (DataSF)
 * - Historical 2016-2019: pyih-qa8i.json (DataSF)
 */

import { normalizeRestaurantName, normalizeAddress, calculateMatchScore } from './matching.js';

const SF_BASE_URL = 'https://data.sfgov.org/resource';
const CURRENT_DATASET = 'tvy3-wexg.json';
const HISTORICAL_DATASET = 'pyih-qa8i.json';

export function formatSFDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function getSFPlacardInfo(statusStr, scoreNum) {
  const s = (statusStr || '').toLowerCase();
  if (s.includes('pass') && !s.includes('conditional')) {
    return {
      status: 'Pass',
      badgeClass: 'pass',
      color: '#10b981',
      icon: '🟢',
      label: 'Pass',
      description: 'Satisfactory food safety practices in compliance with SF Public Health Code.'
    };
  } else if (s.includes('conditional') || s.includes('improvement')) {
    return {
      status: 'Conditional Pass',
      badgeClass: 'conditional',
      color: '#f59e0b',
      icon: '🟡',
      label: 'Conditional Pass',
      description: 'Violations observed requiring corrective action and reinspection.'
    };
  } else if (s.includes('close') || s.includes('closed') || s.includes('red') || s.includes('suspension')) {
    return {
      status: 'Closure',
      badgeClass: 'closure',
      color: '#ef4444',
      icon: '🔴',
      label: 'Closure / Suspension',
      description: 'Health permit suspended or closure ordered.'
    };
  }

  if (scoreNum !== null && !isNaN(scoreNum)) {
    if (scoreNum >= 90) return { status: 'Pass', badgeClass: 'pass', color: '#10b981', icon: '🟢', label: 'Pass', description: 'Score >= 90.' };
    if (scoreNum >= 75) return { status: 'Conditional Pass', badgeClass: 'conditional', color: '#f59e0b', icon: '🟡', label: 'Needs Improvement', description: 'Score 75-89.' };
    return { status: 'Major Violations', badgeClass: 'closure', color: '#ef4444', icon: '🔴', label: 'Warning', description: 'Score < 75.' };
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

export async function querySanFranciscoCounty(restaurantName, address = '') {
  try {
    const { primaryName, cleanTokens, searchToken } = normalizeRestaurantName(restaurantName);
    const addrNorm = normalizeAddress(address);

    let records = [];

    // Step 1: Address-First Query in SF
    if (addrNorm.streetNumber && addrNorm.streetWord) {
      const whereAddr = encodeURIComponent(`upper(street_address) like upper('%${addrNorm.streetNumber}%${addrNorm.streetWord}%')`);
      const url = `${SF_BASE_URL}/${CURRENT_DATASET}?$where=${whereAddr}&$order=inspection_date%20DESC&$limit=20`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          records = data;
        }
      }
    }

    // Step 2: Name Query Fallback
    if (records.length === 0 && searchToken) {
      const whereClause = encodeURIComponent(`upper(dba) like upper('%${searchToken}%')`);
      const url = `${SF_BASE_URL}/${CURRENT_DATASET}?$where=${whereClause}&$order=inspection_date%20DESC&$limit=20`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          records = data;
        }
      }
    }

    if (records.length === 0) {
      return await querySFHistorical(restaurantName, address);
    }

    // Group by location
    const grouped = new Map();
    for (const rec of records) {
      const key = `${rec.dba}_${rec.street_address || ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(rec);
    }

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

    // Parse violation codes into structured objects
    const rawViolations = latest.violation_codes ? latest.violation_codes.split(', ') : [];
    const violations = rawViolations.map(codeStr => {
      const isCritical = /113952|113953|113996|114259|temperature|hands|vermin|rodent/i.test(codeStr);
      const parts = codeStr.split(' - ');
      return {
        code: parts[0] || '',
        description: parts[1] || codeStr,
        critical: isCritical,
        comment: parts[1] || codeStr
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

    const officialUrl = `https://data.sfgov.org/Health/Health-Inspection-Scores-2024-Present/g8m3-pdis/data?query=${encodeURIComponent(latest.dba)}`;

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
      portalUrl: officialUrl,
      officialDatasetUrl: officialUrl,
      reportPdfUrl: officialUrl
    };
  } catch (error) {
    console.error('DineExpress: SF Query failed', error);
    return null;
  }
}

async function querySFHistorical(restaurantName, address) {
  try {
    const { primaryName, cleanTokens, searchToken } = normalizeRestaurantName(restaurantName);
    const addrNorm = normalizeAddress(address);

    let records = [];

    if (addrNorm.streetNumber && addrNorm.streetWord) {
      const whereAddr = encodeURIComponent(`upper(business_address) like upper('%${addrNorm.streetNumber}%${addrNorm.streetWord}%')`);
      const url = `${SF_BASE_URL}/${HISTORICAL_DATASET}?$where=${whereAddr}&$order=inspection_date%20DESC&$limit=10`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) records = data;
      }
    }

    if (records.length === 0 && searchToken) {
      const whereClause = encodeURIComponent(`upper(business_name) like upper('%${searchToken}%')`);
      const url = `${SF_BASE_URL}/${HISTORICAL_DATASET}?$where=${whereClause}&$order=inspection_date%20DESC&$limit=10`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) records = data;
      }
    }

    if (records.length === 0) return null;

    const latest = records[0];
    const scoreNum = latest.inspection_score ? Number(latest.inspection_score) : null;
    const placard = getSFPlacardInfo(null, scoreNum);
    const officialUrl = `https://data.sfgov.org/resource/pyih-qa8i?business_id=${latest.business_id}`;

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
          code: r.violation_id || '',
          comment: r.violation_description || ''
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
      portalUrl: officialUrl,
      officialDatasetUrl: officialUrl,
      reportPdfUrl: officialUrl
    };
  } catch (err) {
    return null;
  }
}
