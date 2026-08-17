# Privacy Policy for DineExpress

**Last Updated:** August 16, 2026

DineExpress is committed to protecting your privacy.

## 1. Data Collection & Analytics
- **No Personal Data Collected**: DineExpress does not collect, log, transmit, track, or sell any personal data, IP addresses, browsing histories, search queries, or user identifiers.
- **Local Browser Execution**: All queries to municipal open data APIs (e.g. DataSF, SCC Open Data) are performed directly from your local browser client or cached locally inside `chrome.storage.local`.
- **No Third-Party Trackers**: DineExpress contains no advertising networks, analytics tracking scripts, telemetry, or third-party cookies.

## 2. Permissions Justification
- `storage`: Used exclusively to cache restaurant inspection records locally on your device for up to 24 hours to accelerate page load times and avoid repeated government API calls.
- `activeTab` / Host Permissions: Used strictly to detect restaurant names and addresses on Google Maps pages (`https://www.google.com/maps/*`) to query the corresponding public health inspection records.

## 3. Open Source Transparency
The source code of this extension is publicly available for audit at [https://github.com/yuxuanzhu0214/dine_express](https://github.com/yuxuanzhu0214/dine_express).
