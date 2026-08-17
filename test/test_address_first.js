import { normalizeAddress, normalizeRestaurantName, calculateMatchScore } from '../src/api/matching.js';
import { querySantaClaraCounty } from '../src/api/sccApi.js';
import { querySanFranciscoCounty } from '../src/api/sfApi.js';
import { searchRestaurantHealthReport } from '../src/api/unifiedService.js';

async function testAddressFirst() {
  console.log('Testing Address-First Multi-Location & DBA resolution...\n');

  const cases = [
    {
      label: 'Fashion Wok (Different DBA name at 101 S Murphy Ave, Sunnyvale)',
      name: 'Fashion Wok',
      address: '101 S Murphy Ave, Sunnyvale, CA 94086'
    },
    {
      label: 'Master Oh (1484 Halford Ave, Santa Clara)',
      name: 'Master Oh',
      address: '1484 Halford Ave, Santa Clara, CA 95051'
    },
    {
      label: 'In-N-Out Mountain View branch',
      name: 'In-N-Out Burger',
      address: '1150 N Rengstorff Ave, Mountain View, CA 94043'
    },
    {
      label: 'In-N-Out Santa Clara branch',
      name: 'In-N-Out Burger',
      address: '3001 Mission College Blvd, Santa Clara, CA 95054'
    },
    {
      label: 'Marufuku Ramen San Francisco branch',
      name: 'Marufuku Ramen',
      address: '1581 Webster St, San Francisco, CA 94115'
    }
  ];

  for (const c of cases) {
    console.log(`----------------------------------------`);
    console.log(`CASE: ${c.label}`);
    console.log(`Input: "${c.name}", "${c.address}"`);
    const res = await searchRestaurantHealthReport(c.name, c.address);
    console.log(`Matched: ${res.matched ? 'YES' : 'NO'}`);
    console.log(`Business Name: ${res.businessName}`);
    console.log(`Address: ${res.address} (${res.city})`);
    console.log(`Score / Status: ${res.score} / ${res.status}`);
    console.log(`Official Detail Link: ${res.officialDatasetUrl}`);
  }
}

testAddressFirst();
