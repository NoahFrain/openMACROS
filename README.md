# openMACROS

A private, offline-first nutrition tracker and adaptive macro coach — built as a companion PWA to **openGAINS**. Installs to your home screen, keeps every meal and weigh-in local on your device, and optionally connects directly to live food databases when online.

Paying for shit is overrated, me and my close personal friend Claude think so at least. Try this in place of your nutrition tracker and let me know what you think.

---

## Structure

Five source files, no build step, no bundler.

```
index.html              shell, all styles, app mount point
core.js                 pure nutrition, adaptive coaching & API/QR parsers (node-testable)
app.js                  state, rendering, live DB search, camera scanner, localStorage
sw.js                   service worker, network-first for app shell, pass-through for APIs
manifest.webmanifest    PWA metadata
icon-180/192/512.png    home screen icons
```

Four tabs: **Log**, **Plan**, **Body**, **Data**.

---

## Key Capabilities

- **Live Food Databases**:
  - **Open Food Facts** — works out of the box with no API key for packaged food search and UPC/EAN barcode lookups.
  - **USDA FoodData Central** — paste your free personal API key (`fdc.nal.usda.gov/api-key-signup`) in **Data → Food databases** (stored only in your device's `localStorage`) for lab-verified whole and branded foods with deep micronutrients.
  - **Offline Caching** — any online food you log or scan is automatically saved into your local food library so repeat logs work offline.
- **Barcode & QR Code Scanner**:
  - Uses the native browser `BarcodeDetector` API on Chrome/Android and automatically lazy-loads `html5-qrcode` as a WebKit/iOS Safari fallback, plus a manual barcode/QR entry field.
  - Handles UPC/EAN food barcodes, GS1/OFF product URLs, and custom JSON food QR codes.
- **Goal & Plan Builder**: Fat Loss, Dynamic Maintenance, or Muscle Gain; body stats & optional body fat %, target weight, weekly pace or target date, protein tier, and carb/fat split.
- **Adaptive Expenditure & Weekly Check-In**: Linear-interpolated EWMA weight trend + rolling intake adaptive TDEE estimation with non-punitive weekly target updates.
- **Food, Recipes & Micros**: 60+ offline starter foods, custom foods, multi-ingredient Saved Meals/Recipes, Quick Add, water tracking, and Fiber/Sodium/Potassium/Calcium/Iron/Vitamin D bars.
- **Body Composition & Exports**: Scale vs. Trend Weight chart, Adaptive Expenditure chart, 14-day intake bar chart, US Navy BF% estimator, Diary & Biometrics CSV exports, and JSON backup/restore.

---

## Changelog

### v2 — 2026-11-22
- Direct **Open Food Facts** text search & barcode lookup (no API key required)
- Direct **USDA FoodData Central** search & barcode fallback via local-only API key setting
- Camera **Barcode & QR Code Scanner** (native `BarcodeDetector` + automatic iOS Safari `html5-qrcode` fallback + manual input)
- Automatic local caching of online/scanned foods for offline reuse

### v1 — 2026-11-22
- Initial offline-first PWA release matching the **openGAINS** gray & dark-muted-purple design system
