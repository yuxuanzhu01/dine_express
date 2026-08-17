import { searchRestaurantHealthReport } from '../src/api/unifiedService.js';

async function runTests() {
  console.log('🚀 Starting DineExpress API Verification Tests...\n');

  const testCases = [
    {
      name: 'Master Oh 오선생 (Santa Clara County - User Screenshot Example)',
      queryName: 'Master Oh 오선생',
      address: '1484 Halford Ave, Santa Clara, CA 95051'
    },
    {
      name: 'Tartine Bakery (San Francisco County)',
      queryName: 'Tartine Bakery',
      address: '600 Guerrero St, San Francisco, CA 94110'
    },
    {
      name: 'San Tung (San Francisco County)',
      queryName: 'San Tung',
      address: '1031 Irving St, San Francisco, CA 94122'
    },
    {
      name: 'Levy Premium Food Serv (Sonoma County)',
      queryName: 'Levy Premium Food Serv',
      address: 'Sonoma, CA'
    },
    {
      name: 'Pacific Catch (San Mateo County - Portal Fallback)',
      queryName: 'Pacific Catch',
      address: 'San Mateo, CA'
    }
  ];

  for (const tc of testCases) {
    console.log(`=======================================================`);
    console.log(`TEST: ${tc.name}`);
    console.log(`Input: "${tc.queryName}", Address: "${tc.address}"`);
    
    const startTime = Date.now();
    const result = await searchRestaurantHealthReport(tc.queryName, tc.address);
    const duration = Date.now() - startTime;

    console.log(`⏱️ Query Time: ${duration}ms`);
    console.log(`Matched: ${result.matched ? '✅ YES' : 'ℹ️ NO (Portal Fallback)'}`);
    console.log(`County: ${result.countyName}`);
    console.log(`Business Name: ${result.businessName}`);
    console.log(`Status / Placard: ${result.placard?.label} (${result.status})`);
    if (result.score !== null) {
      console.log(`Health Score: ${result.score} / 100`);
    }
    if (result.latestInspection) {
      console.log(`Latest Inspection Date: ${result.latestInspection.date} (${result.latestInspection.type})`);
      console.log(`Violations: Total ${result.latestInspection.violationsCount}, Critical: ${result.latestInspection.criticalViolationsCount}`);
      if (result.latestInspection.comment) {
        console.log(`Comment: ${result.latestInspection.comment.slice(0, 120)}...`);
      }
    }
    console.log(`History Count: ${result.history.length} inspections`);
    console.log(`Portal Link: ${result.portalUrl || result.searchDeepLink}`);
    console.log(`\n`);
  }

  console.log('🎉 All test cases processed successfully!');
}

runTests();
