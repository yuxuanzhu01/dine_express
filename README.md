# 🥗 DineExpress - Bay Area Food Safety & Health Scores for Google Maps

![Chrome Extension](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=google-chrome&logoColor=white)
![Bay Area Open Data](https://img.shields.io/badge/OpenData-Socrata%20%26%20DEH-10b981?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

**DineExpress** is a Google Chrome extension (Manifest V3) that injects real-time food safety inspection scores, official health department placard ratings, violation details, and historical inspection timelines directly onto **Google Maps** restaurant pages.

---

## ✨ Features

- 🛡️ **Real-Time Health Scores & Placards**: Automatically displays Pass (🟢 Green), Conditional Pass (🟡 Yellow), or Closure / Critical Violation (🔴 Red) status and numerical scores (0–100) right in the Google Maps place detail pane.
- 📜 **Interactive Historical Reports Accordion**: View the complete chronological timeline of previous routine and follow-up inspections, past scores, dates, and inspector comments with a single click.
- 🔍 **Detailed Violation Breakdown**: Summarizes critical risk violations (e.g. food temperature, handwashing, vermin) versus non-critical infractions.
- 🏛️ **Official County Deep Links**: Instant direct link to the certified County Environmental Health Department portal or open data records for official documentation.
- ⚡ **Multi-County Support across 9 Bay Area Counties**:
  - **Santa Clara County**: Live integration with SCC DEH Open Data Socrata API (`vuw7-jmjk`, `2u2d-8jej`, `wkaa-4ccv` / SCCDineOut).
  - **San Francisco County**: Live integration with DataSF 2024-Present Health Inspection feed (`tvy3-wexg`) and historical LIVES records.
  - **Sonoma County**: Live integration with Sonoma County Health Services Socrata API (`hfrk-rewb`).
  - **Alameda, San Mateo, Contra Costa, Marin, Solano, Napa Counties**: Direct resolvers and search deep links to official environmental health portals.
- 🚀 **Built-in Fast Cache**: Caches results locally via `chrome.storage.local` with a 24-hour TTL for instant responsiveness without redundant API calls.
- 🔎 **Standalone Popup Search**: Search any Bay Area restaurant by name and county directly from the extension icon popup.

---

## 📸 How It Looks on Google Maps

When viewing a restaurant (e.g. *Master Oh 오선생*, *Tartine Bakery*, *San Tung*):

```
┌─────────────────────────────────────────────────────────────┐
│  Master Oh 오선생                                           │
│  4.3 ★★★★☆ (184) · $20–60 · Korean restaurant               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🟢 Pass (Green Placard)                       81/100  │  │
│  │ 🏛️ Santa Clara County       Latest: Jun 11, 2026      │  │
│  │ ───────────────────────────────────────────────────── │  │
│  │ Inspection Type: FOLLOW-UP INSPECTION                 │  │
│  │ Compliance Status: ✅ 0 Violations Observed           │  │
│  │ "On-site follow-up inspection... Status: PASS"        │  │
│  │                                                       │  │
│  │ [📜 Historical Reports (8 inspections) ▾]             │  │
│  │   • Jun 08, 2026 — Score: 62 (Closure / Vermin)       │  │
│  │   • Aug 07, 2025 — Score: 81 (Pass)                   │  │
│  │   • May 14, 2025 — Score: 76 (Pass)                   │  │
│  │   • Apr 10, 2025 — Score: 74 (Conditional Pass)       │  │
│  │                                                       │  │
│  │ [Official Health Records ↗]               [🔄 Refresh]│  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [ Directions ]  [ Save ]  [ Nearby ]  [ Share ]            │
│  [                🍽️ Order online                      ]    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Installation & Deployment

### Method 1: Load Locally in Google Chrome (Developer Mode)

1. Open **Google Chrome** on your computer.
2. In the URL address bar, navigate to:
   ```
   chrome://extensions
   ```
3. Enable **"Developer mode"** by toggling the switch in the top right corner.
4. Click the **"Load unpacked"** button in the top left corner.
5. In the file picker dialog, select the project directory:
   ```
   /Users/yuxuanzhu/dev/dine_express
   ```
6. The extension **"DineExpress - Bay Area Food Safety & Health Scores"** is now installed and active!
7. Visit [Google Maps](https://www.google.com/maps) and search for any Bay Area restaurant (e.g. *Master Oh*, *Tartine Bakery*, *San Tung*) to see the health report cards appear automatically.

---

### Method 2: Push to Your Git Code Repository

To push this project to your GitHub / GitLab repository:

```bash
# 1. Open terminal and navigate to the project directory
cd /Users/yuxuanzhu/dev/dine_express

# 2. Add all files to git
git add .

# 3. Create your initial commit
git commit -m "feat: initial commit of DineExpress Chrome Extension for Google Maps"

# 4. Link your remote GitHub repository (replace URL with your own repo URL)
git remote add origin https://github.com/<your-username>/dine_express.git

# 5. Push to main branch
git branch -M main
git push -u origin main
```

---

### Method 3: Publish to the Chrome Web Store

1. In the project directory, zip the contents (excluding `.git` and `test`):
   ```bash
   zip -r dine_express_v1.0.0.zip . -x "*.git*" "test/*" "scripts/*" ".DS_Store"
   ```
2. Navigate to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devcenter).
3. Click **"New Item"** and upload `dine_express_v1.0.0.zip`.
4. Fill in the store listing descriptions, upload screenshots, and submit for review.

---

## 🧪 Testing the APIs

You can run the built-in automated test suite to verify live queries against all Bay Area open data endpoints:

```bash
npm test
```

---

## 📁 Repository Structure

```
dine_express/
├── manifest.json            # Chrome Manifest V3 configuration
├── package.json             # NPM package and script definitions
├── README.md                # Project documentation and deployment guide
├── icons/                   # High-res SVG and PNG extension icons
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── popup/                   # Extension popup interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── src/
│   ├── background/
│   │   └── background.js    # Service worker with 24h caching & message router
│   ├── content/
│   │   ├── content.js       # Google Maps DOM observer & card injector
│   │   └── content.css      # Card styles, placard badges, and animations
│   ├── api/
│   │   ├── countyInfo.js    # County registry & city-to-county mapping
│   │   ├── matching.js      # Resilient name & address fuzzy matching
│   │   ├── sccApi.js        # Santa Clara County Socrata API integration
│   │   ├── sfApi.js         # San Francisco DataSF Socrata API integration
│   │   ├── sonomaApi.js     # Sonoma County Socrata API integration
│   │   └── unifiedService.js # Central orchestrator & deep link builder
│   └── utils/
├── scripts/
│   └── generate_icons.js    # Script to regenerate PNG icons
└── test/
    └── test_queries.js      # Automated test suite
```

---

## 🏛️ Data Sources & Attribution

- **Santa Clara County**: [SCC Open Data Portal (data.sccgov.org)](https://data.sccgov.org) & [SCCDineOut](https://cpd.sccgov.org/sccdineout-mobile-app)
- **City and County of San Francisco**: [DataSF Open Data (data.sfgov.org)](https://data.sfgov.org)
- **Sonoma County**: [Sonoma County Open Data Portal (data.sonomacounty.ca.gov)](https://data.sonomacounty.ca.gov)
- **Alameda, San Mateo, Contra Costa, Marin, Solano, Napa**: Respective County Departments of Environmental Health Services.

---

## 📄 License

Distributed under the MIT License.
