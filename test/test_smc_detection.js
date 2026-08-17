import { detectCounty, BAY_AREA_COUNTIES } from '../src/api/countyInfo.js';
import { searchRestaurantHealthReport } from '../src/api/unifiedService.js';

const testAddresses = [
  { name: 'Ramen Parlor', addr: '901 S B St, San Mateo, CA 94401' },
  { name: 'B Street & Vine', addr: '320 S B St, San Mateo, CA 94401' },
  { name: 'Gyu-Kaku Japanese BBQ', addr: '410 E 3rd Ave, San Mateo, CA 94401' },
  { name: 'Pacific Catch', addr: '2901 S El Camino Real, San Mateo, CA 94403' },
  { name: 'Pizzakos', addr: 'Burlingame, CA 94010' },
  { name: 'Town', addr: '716 Laurel St, San Carlos, CA 94070' }
];

for (const t of testAddresses) {
  const county = detectCounty(t.addr);
  console.log(`Address: "${t.addr}" -> Detected: ${county?.name || 'NULL'}`);
  const report = await searchRestaurantHealthReport(t.name, t.addr);
  console.log(`  Report: Status: "${report.status}", Placard: "${report.placard?.label}", Portal: "${report.portalUrl}"`);
}
