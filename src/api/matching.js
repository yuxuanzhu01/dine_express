/**
 * DineExpress - Text and Address Matching Utilities
 * Provides resilient normalization and fuzzy comparison between Google Maps and County records.
 */

/**
 * Extracts primary name components, stripping non-Latin secondary scripts, branch numbers, and punctuation.
 * @param {string} rawName
 * @returns {{ primaryName: string, cleanTokens: string[], rawClean: string }}
 */
export function normalizeRestaurantName(rawName) {
  if (!rawName) return { primaryName: '', cleanTokens: [], rawClean: '' };

  let name = rawName.trim();

  // 1. Remove non-Latin scripts that follow Latin text (e.g. "Master Oh 오선생" -> "Master Oh")
  // Or if it starts with non-Latin and has Latin, capture both
  const dualScriptMatch = name.match(/^([A-Za-z0-9\s'&.,\-]+)([\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF].*)$/);
  if (dualScriptMatch && dualScriptMatch[1].trim().length > 1) {
    name = dualScriptMatch[1].trim();
  }

  // 2. Remove parenthesized notes (e.g., "(Castro)", "(Store #123)", "(Downtown)")
  name = name.replace(/\s*\([^)]*\)/g, ' ');

  // 3. Remove store numbers like "#123", "No. 4", "- 9th Ave"
  name = name.replace(/\s*#\d+/g, '');
  name = name.replace(/\s*-\s*[0-9]+[a-zA-Z\s]+$/g, '');

  // 4. Clean special characters but preserve apostrophes and hyphens
  const rawClean = name.replace(/[^\w\s'&]/gi, ' ').replace(/\s+/g, ' ').trim();

  // 5. Build clean comparison tokens (stripping common stopwords like "the", "restaurant", "cafe", "llc", "inc")
  const stopWords = new Set(['the', 'and', 'llc', 'inc', 'corp', 'co', 'dba', 'restaurant', 'cafe', 'bistro', 'kitchen', 'express', 'food', 'foods']);
  const tokens = rawClean
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 0 && !stopWords.has(t));

  return {
    primaryName: name,
    cleanTokens: tokens.length > 0 ? tokens : rawClean.toLowerCase().split(/\s+/).filter(Boolean),
    rawClean: rawClean
  };
}

/**
 * Normalizes street address into street number, street name, and city
 * @param {string} rawAddress
 * @returns {{ streetNumber: string, streetName: string, rawClean: string }}
 */
export function normalizeAddress(rawAddress) {
  if (!rawAddress) return { streetNumber: '', streetName: '', rawClean: '' };

  let clean = rawAddress
    .replace(/,\s*USA$/i, '')
    .replace(/,\s*United States$/i, '')
    .replace(/suite\s*[a-z0-9\-]+/i, '')
    .replace(/ste\s*[a-z0-9\-]+/i, '')
    .replace(/spc\s*[a-z0-9\-]+/i, '')
    .replace(/unit\s*[a-z0-9\-]+/i, '')
    .replace(/#\s*[a-z0-9\-]+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const numMatch = clean.match(/^(\d+)/);
  const streetNumber = numMatch ? numMatch[1] : '';

  // Standardize street suffixes
  let streetPart = clean
    .replace(/^\d+\s+/, '')
    .replace(/\bAvenue\b/i, 'Ave')
    .replace(/\bBoulevard\b/i, 'Blvd')
    .replace(/\bStreet\b/i, 'St')
    .replace(/\bDrive\b/i, 'Dr')
    .replace(/\bRoad\b/i, 'Rd')
    .replace(/\bWay\b/i, 'Way')
    .replace(/\bHighway\b/i, 'Hwy')
    .replace(/\bParkway\b/i, 'Pkwy')
    .replace(/\bLane\b/i, 'Ln')
    .replace(/\bCourt\b/i, 'Ct')
    .toLowerCase();

  return {
    streetNumber,
    streetName: streetPart,
    rawClean: clean
  };
}

/**
 * Computes Dice / Bigram coefficient similarity between two strings
 * @param {string} a
 * @param {string} b
 * @returns {number} Score from 0.0 to 1.0
 */
export function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase().replace(/\s+/g, '');
  const s2 = b.toLowerCase().replace(/\s+/g, '');
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1.0 : 0.0;

  const getBigrams = str => {
    const bigrams = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;

  for (const [bg, count1] of bg1.entries()) {
    if (bg2.has(bg)) {
      intersection += Math.min(count1, bg2.get(bg));
    }
  }

  const total = (s1.length - 1) + (s2.length - 1);
  return total > 0 ? (2.0 * intersection) / total : 0;
}

/**
 * Calculates overall match score between target search parameters and candidate record
 * @param {{ name: string, address: string }} target
 * @param {{ name: string, address: string }} candidate
 * @returns {number} Score between 0 and 100
 */
export function calculateMatchScore(target, candidate) {
  if (!target.name || !candidate.name) return 0;

  const targetNameNorm = normalizeRestaurantName(target.name);
  const candNameNorm = normalizeRestaurantName(candidate.name);

  // 1. Name Dice Similarity (0 - 50 points)
  const nameSim = stringSimilarity(targetNameNorm.rawClean, candNameNorm.rawClean);
  let score = nameSim * 50;

  // 2. Token Overlap Bonus (0 - 25 points)
  if (targetNameNorm.cleanTokens.length > 0 && candNameNorm.cleanTokens.length > 0) {
    const targetSet = new Set(targetNameNorm.cleanTokens);
    const candSet = new Set(candNameNorm.cleanTokens);
    let matchedTokens = 0;
    for (const t of targetSet) {
      if (candSet.has(t) || Array.from(candSet).some(c => c.includes(t) || t.includes(c))) {
        matchedTokens++;
      }
    }
    const tokenScore = (matchedTokens / targetNameNorm.cleanTokens.length) * 25;
    score += tokenScore;
  }

  // 3. Exact Substring Match bonus (+15 points)
  const tLow = targetNameNorm.rawClean.toLowerCase();
  const cLow = candNameNorm.rawClean.toLowerCase();
  if (cLow.includes(tLow) || tLow.includes(cLow)) {
    score += 15;
  }

  // 4. Address Street Number & Street Name Matching (0 - 35 points)
  if (target.address && candidate.address) {
    const targetAddr = normalizeAddress(target.address);
    const candAddr = normalizeAddress(candidate.address);

    if (targetAddr.streetNumber && candAddr.streetNumber) {
      if (targetAddr.streetNumber === candAddr.streetNumber) {
        score += 25; // Massive signal for same building number
      } else {
        score -= 20; // Penalize different building numbers if present
      }
    }

    if (targetAddr.streetName && candAddr.streetName) {
      const addrSim = stringSimilarity(targetAddr.streetName, candAddr.streetName);
      if (addrSim > 0.6) {
        score += 10;
      }
    }
  }

  return Math.min(Math.max(score, 0), 100);
}
