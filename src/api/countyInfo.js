/**
 * DineExpress - Bay Area County Information & Portal Registry
 * Supports all 9 counties in the San Francisco Bay Area.
 */

export const BAY_AREA_COUNTIES = {
  SANTA_CLARA: {
    id: 'santa_clara',
    name: 'Santa Clara County',
    shortName: 'Santa Clara',
    hasDirectApi: true,
    apiType: 'socrata',
    portalName: 'SCCDineOut / SCC Open Data',
    portalUrl: 'https://cpd.sccgov.org/sccdineout-mobile-app',
    datasetUrl: 'https://data.sccgov.org/browse?q=food+facility',
    searchUrlBuilder: (query) => `https://cpd.sccgov.org/sccdineout-mobile-app`,
    cities: [
      'san jose', 'santa clara', 'sunnyvale', 'mountain view', 'palo alto',
      'cupertino', 'milpitas', 'campbell', 'gilroy', 'los gatos', 'morgan hill',
      'saratoga', 'los altos', 'los altos hills', 'monte sereno', 'stanford', 'alviso'
    ],
    zipPrefixes: ['950', '951', '94022', '94024', '94040', '94041', '94043', '94085', '94086', '94087', '94088', '94089', '94301', '94303', '94304', '94305', '94306']
  },
  SAN_FRANCISCO: {
    id: 'san_francisco',
    name: 'San Francisco County',
    shortName: 'San Francisco',
    hasDirectApi: true,
    apiType: 'socrata',
    portalName: 'DataSF Health Inspections',
    portalUrl: 'https://data.sfgov.org/Health/Health-Inspection-Scores-2024-Present/g8m3-pdis',
    datasetUrl: 'https://data.sfgov.org/resource/tvy3-wexg.json',
    searchUrlBuilder: (query) => `https://data.sfgov.org/Health/Health-Inspection-Scores-2024-Present/g8m3-pdis/data?query=${encodeURIComponent(query)}`,
    cities: [
      'san francisco', 'sf'
    ],
    zipPrefixes: ['941']
  },
  SAN_MATEO: {
    id: 'san_mateo',
    name: 'San Mateo County',
    shortName: 'San Mateo',
    hasDirectApi: false,
    portalName: 'San Mateo County Health Inspection Search',
    portalUrl: 'https://smcehs.my.site.com/s/inspection-report-search?language=en_US',
    datasetUrl: 'https://www.smchealth.org/food-inspection-results',
    searchUrlBuilder: (query) => `https://smcehs.my.site.com/s/inspection-report-search?language=en_US`,
    cities: [
      'san mateo', 'redwood city', 'burlingame', 'daly city', 'south san francisco',
      'san bruno', 'menlo park', 'foster city', 'belmont', 'san carlos',
      'millbrae', 'pacifica', 'half moon bay', 'hillsborough', 'atherton',
      'woodside', 'portola valley', 'brisbane', 'colma', 'east palo alto', 'el granada', 'montara', 'moss beach'
    ],
    zipPrefixes: ['940', '944']
  },
  ALAMEDA: {
    id: 'alameda',
    name: 'Alameda County',
    shortName: 'Alameda',
    hasDirectApi: false,
    portalName: 'Alameda County DEH Food Safety',
    portalUrl: 'https://deh.acgov.org/',
    datasetUrl: 'https://data.acgov.org/',
    searchUrlBuilder: (query) => `https://deh.acgov.org/`,
    cities: [
      'oakland', 'berkeley', 'fremont', 'hayward', 'alameda',
      'san leandro', 'pleasanton', 'dublin', 'livermore', 'union city',
      'newark', 'emeryville', 'albany', 'piedmont', 'castro valley', 'san lorenzo', 'sunol'
    ],
    zipPrefixes: ['945', '946', '947']
  },
  CONTRA_COSTA: {
    id: 'contra_costa',
    name: 'Contra Costa County',
    shortName: 'Contra Costa',
    hasDirectApi: false,
    portalName: 'Contra Costa Health Food Safety Portal',
    portalUrl: 'https://hsdmobile.cchealth.org/ffinspectionsearch/Default',
    datasetUrl: 'https://www.cchealth.org/eh/retail-food',
    searchUrlBuilder: (query) => `https://hsdmobile.cchealth.org/ffinspectionsearch/Default`,
    cities: [
      'walnut creek', 'concord', 'richmond', 'antioch', 'san ramon',
      'danville', 'pleasant hill', 'martinez', 'pittsburg', 'lafayette',
      'moraga', 'orinda', 'brentwood', 'oakley', 'el cerrito',
      'hercules', 'pinole', 'san pablo', 'clayton', 'el sobrante'
    ],
    zipPrefixes: ['945', '948']
  },
  SONOMA: {
    id: 'sonoma',
    name: 'Sonoma County',
    shortName: 'Sonoma',
    hasDirectApi: true,
    apiType: 'socrata',
    portalName: 'Sonoma County Food Facility Inspections',
    portalUrl: 'https://sonomacounty.ca.gov/health-and-human-services/health-services/divisions/public-health/environmental-health-and-safety/food-safety',
    datasetUrl: 'https://data.sonomacounty.ca.gov/resource/hfrk-rewb.json',
    searchUrlBuilder: (query) => `https://data.sonomacounty.ca.gov/browse?q=${encodeURIComponent(query)}`,
    cities: [
      'santa rosa', 'petaluma', 'rohnert park', 'sonoma', 'healdsburg',
      'windsor', 'sebastopol', 'cloverdale', 'cotati'
    ],
    zipPrefixes: ['954']
  },
  MARIN: {
    id: 'marin',
    name: 'Marin County',
    shortName: 'Marin',
    hasDirectApi: false,
    portalName: 'Marin County Environmental Health Services',
    portalUrl: 'https://www.marincounty.gov/departments/cda/environmental-health-services/food-safety',
    datasetUrl: 'https://www.marincounty.gov/',
    searchUrlBuilder: (query) => `https://www.google.com/search?q=${encodeURIComponent(query + ' Marin County food safety inspection')}`,
    cities: [
      'san rafael', 'novato', 'mill valley', 'san anselmo', 'larkspur',
      'corte madera', 'tiburon', 'sausalito', 'fairfax', 'ross', 'belvedere'
    ],
    zipPrefixes: ['949']
  },
  SOLANO: {
    id: 'solano',
    name: 'Solano County',
    shortName: 'Solano',
    hasDirectApi: false,
    portalName: 'Solano County Environmental Health Accela Portal',
    portalUrl: 'https://aca-prod.accela.com/SOLANO/Cap/CapHome.aspx?module=EnvHealth',
    datasetUrl: 'https://aca-prod.accela.com/SOLANO/Cap/CapHome.aspx?module=EnvHealth',
    searchUrlBuilder: (query) => `https://aca-prod.accela.com/SOLANO/Cap/CapHome.aspx?module=EnvHealth`,
    cities: [
      'vallejo', 'fairfield', 'vacaville', 'suisun city', 'benicia', 'dixon', 'rio vista'
    ],
    zipPrefixes: ['94589', '94590', '94591', '94533', '94534', '94585', '94510', '95620', '95687', '95688']
  },
  NAPA: {
    id: 'napa',
    name: 'Napa County',
    shortName: 'Napa',
    hasDirectApi: false,
    portalName: 'Napa County Environmental Health Food Program',
    portalUrl: 'https://www.countyofnapa.org/1678/Food-Program',
    datasetUrl: 'https://www.countyofnapa.org/',
    searchUrlBuilder: (query) => `https://www.countyofnapa.org/1678/Food-Program`,
    cities: [
      'napa', 'american canyon', 'st. helena', 'calistoga', 'yountville'
    ],
    zipPrefixes: ['94558', '94559', '94503', '94574', '94515', '94599']
  }
};

/**
 * Detect county by city name, address text, or zip code
 * @param {string} addressStr
 * @returns {object|null} County definition or null if unknown
 */
export function detectCounty(addressStr) {
  if (!addressStr) return null;
  const lower = addressStr.toLowerCase();

  // 1. Direct city name matching (word boundary)
  for (const county of Object.values(BAY_AREA_COUNTIES)) {
    for (const city of county.cities) {
      const cityRegex = new RegExp(`\\b${city.replace('.', '\\.')}\\b`, 'i');
      if (cityRegex.test(lower)) {
        return county;
      }
    }
  }

  // 2. Direct zip code match
  const zipMatch = lower.match(/\b(\d{5})\b/);
  if (zipMatch) {
    const zip = zipMatch[1];
    for (const county of Object.values(BAY_AREA_COUNTIES)) {
      if (county.zipPrefixes.some(prefix => zip.startsWith(prefix))) {
        return county;
      }
    }
  }

  // 3. County name keyword in text
  for (const county of Object.values(BAY_AREA_COUNTIES)) {
    if (lower.includes(county.shortName.toLowerCase()) || lower.includes(county.name.toLowerCase())) {
      return county;
    }
  }

  return null;
}
