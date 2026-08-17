/**
 * DineExpress - Sonoma County Health Inspection API Client
 * Datasets:
 * - hfrk-rewb.json (Routine Inspections)
 */

import { normalizeRestaurantName, calculateMatchScore } from './matching.js';

const SONOMA_BASE_URL = 'https://data.sonomacounty.ca.gov/resource';
const DATASET = 'hfrk-rewb.json';

export function formatSonomaDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function getSonomaPlacardInfo(violationCount, hasMajor) {
  if (hasMajor) {
    return {
      status: 'Conditional Pass',
      badgeClass: 'conditional',
      color: '#f59e0b',
      icon: '⚠️',
      label: 'Major Violations Observed',
      description: 'Critical food safety violation noted during inspection.'
    };
  }
  if (violationCount === 0) {
    return {
      status: 'Pass',
      badgeClass: 'pass',
      color: '#10b981',
      icon: '✅',
      label: 'Pass (No Violations)',
      description: 'Routine inspection passed cleanly.'
    };
  }
  return {
    status: 'Pass',
    badgeClass: 'pass',
    color: '#10b981',
    icon: '✅',
    label: 'Pass with Minor Notes',
    description: 'Minor non-critical infractions noted and addressed.'
  };
}

export async function querySonomaCounty(restaurantName, address = '') {
  try {
    const { primaryName, cleanTokens } = normalizeRestaurantName(restaurantName);
    const searchToken = cleanTokens[0] || primaryName;
    if (!searchToken) return null;

    const whereClause = encodeURIComponent(`upper(name) like upper('%${searchToken}%')`);
    const url = `${SONOMA_BASE_URL}/${DATASET}?$where=${whereClause}&$order=date%20DESC&$limit=15`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const records = await res.json();
    if (!Array.isArray(records) || records.length === 0) return null;

    // Group by inspection id
    const candidates = records.map(r => ({
      rec: r,
      score: calculateMatchScore({ name: restaurantName, address }, { name: r.name, address: `${r.address || ''} ${r.city || ''}` })
    }));

    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];

    if (!bestMatch || bestMatch.score < 25) {
      return null;
    }

    const latest = bestMatch.rec;
    const rawViols = (latest.violationdescriptions || '').split('|').filter(Boolean);
    const hasMajor = rawViols.some(v => v.toLowerCase().includes('major'));
    const placard = getSonomaPlacardInfo(rawViols.length, hasMajor);

    return {
      county: 'Sonoma County',
      matched: true,
      businessName: latest.name,
      address: latest.address,
      city: latest.city || 'Sonoma County',
      postalCode: '954XX',
      score: null,
      status: placard.status,
      placard: placard,
      latestInspection: {
        date: formatSonomaDate(latest.date),
        rawDate: latest.date,
        type: latest.inspectiontype || 'Routine Inspection',
        score: null,
        result: placard.label,
        comment: rawViols.length > 0 ? `${rawViols.length} violation items recorded.` : 'Clean inspection.',
        violationsCount: rawViols.length,
        criticalViolationsCount: rawViols.filter(v => v.toLowerCase().includes('major')).length,
        violations: rawViols.map(v => ({
          description: v,
          critical: v.toLowerCase().includes('major'),
          code: ''
        }))
      },
      history: [
        {
          inspectionId: latest.inspectionid || '',
          date: formatSonomaDate(latest.date),
          rawDate: latest.date,
          score: null,
          status: placard.status,
          badgeClass: placard.badgeClass,
          type: latest.inspectiontype || 'Routine Inspection',
          comment: rawViols.join(', ') || 'No violations'
        }
      ],
      portalUrl: 'https://sonomacounty.ca.gov/health-and-human-services/health-services/divisions/public-health/environmental-health-and-safety/food-safety',
      officialDatasetUrl: `https://data.sonomacounty.ca.gov/resource/hfrk-rewb?businessid=${latest.businessid}`
    };
  } catch (err) {
    console.error('DineExpress: Sonoma Query failed', err);
    return null;
  }
}
