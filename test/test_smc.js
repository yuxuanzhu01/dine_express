async function testSMCResults() {
  try {
    const res = await fetch("https://www.smchealth.org/food-inspection-results", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    const matches = text.match(/https?:\/\/[^"'\s<>]+/g) || [];
    const filtered = Array.from(new Set(matches)).filter(l => /eh|inspect|food|decade|portal|myehs|search/i.test(l));
    console.log("Found links on smchealth:", filtered);
  } catch(e) {
    console.log("Err:", e.message);
  }
}
testSMCResults();
