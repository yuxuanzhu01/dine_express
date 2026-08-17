import { normalizeAddress, normalizeRestaurantName } from '../src/api/matching.js';

async function testAddressSearch() {
  const name = 'Fashion Wok';
  const address = '101 S Murphy Ave, Sunnyvale, CA 94086';
  
  const addrNorm = normalizeAddress(address);
  console.log('Normalized address:', addrNorm);

  // Search by address in Santa Clara County
  if (addrNorm.streetNumber) {
    const streetFirstWord = addrNorm.streetName.split(/\s+/)[0];
    const whereAddr = encodeURIComponent(`upper(address) like upper('%${addrNorm.streetNumber}%${streetFirstWord}%')`);
    const url = `https://data.sccgov.org/resource/vuw7-jmjk.json?$where=${whereAddr}&$limit=5`;
    console.log('Querying:', url);
    const res = await fetch(url);
    const data = await res.json();
    console.log('Result:', data);
  }
}

testAddressSearch();
