async function testSMCPortal() {
  try {
    const res = await fetch("https://smcehs.my.site.com/s/inspection-report-search?language=en_US", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    console.log("Portal status:", res.status);
    const text = await res.text();
    console.log("Snippet:", text.slice(0, 500));
  } catch(e) {
    console.log("Error:", e.message);
  }
}
testSMCPortal();
