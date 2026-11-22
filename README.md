# openMACROS

A private, offline-first nutrition tracker and adaptive macro coach — built as a companion PWA to **openGAINS**. Installs to your home screen, keeps every meal and weigh-in local on your device, and optionally connects directly to live food databases when online.

Combines **MacroFactor**-style adaptive expenditure coaching (EWMA weight trend + non-punitive weekly check-ins) with **Cronometer**-style whole-food accuracy (macros, key micronutrients, custom recipes, and body composition tracking).

---

## Structure

No build step, no bundler — static files only.

```
index.html                    shell, all styles, app mount point
core.js                       pure nutrition, adaptive coaching & API/QR parsers (node-testable)
core.test.js                  node test suite for core.js  →  node --test
app.js                        state, rendering, live DB search, camera scanner, localStorage
sw.js                         service worker: network-first (2.5s timeout → cache), pass-through for APIs
vendor/html5-qrcode.min.js    bundled iOS/WebKit scanner (Apache-2.0), precached for offline use
manifest.webmanifest          PWA metadata
icon-180/192/512.png          home screen icons
```

### State (`localStorage` key `openmacros.v1`, schema `v: 2`)

```js
{
  settings: { unit, waterUnit, showRemaining, waterGoalOz, usdaKey },   // usdaKey never exported
  profile:  { sex, age, heightIn, startWeightLb, bfPct, activity },
  goal, plan, lastCheckIn,
  foods:    [ { id, name, cat, srvLabel, srvG, kcal, p, c, f, fiber, na, k, ca, fe, vitd, barcode?, source?, fav?, hidden? } ],  // per 100 g
  recipes:  [ { id, name, servings, items: [ { foodId, grams } ] } ],
  logs:     { 'YYYY-MM-DD': [ { id, meal, foodId, grams, snap } | { id, meal, quick: true, name, kcal, p, c, f, fiber } ] },
  dayMeta:  { 'YYYY-MM-DD': 'done' | 'skip' },     // coaching overrides
  water:    { 'YYYY-MM-DD': oz },
  weights:  [ { id, date, weightLb, bf, waist, neck, chest, arms, hips, note } ],  // tape measurements in inches
}
```

- `snap` is a frozen per-100 g copy of the food at log time. Editing or deleting a food never rewrites history.
- Deleting a food sets `hidden: true` so past entries and saved meals still resolve.
- `migrate()` upgrades older state and restored backups (v1 → v2 snapshots entries and converts metric tape measurements to inches).

### Coaching day eligibility

Only finished days feed the adaptive expenditure model. A day counts when it is before today and either marked **complete** or logged at ≥ max(400 kcal, 50% of target). **Exclude** removes a day regardless. The status card at the bottom of the Log tab shows and overrides this per day.

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

## Testing

```
node --test
```

## Changelog

### v2.1 — 2026-11-22
- **Data integrity:** log entries store a nutrient snapshot; food edits/deletes no longer change past days. Foods are soft-deleted. Tapping an entry whose food is missing no longer crashes the app.
- **Coaching accuracy:** today and partial days (< 50% of target) are excluded from adaptive expenditure; per-day *Mark complete / Exclude* override. *Keep current* on the weekly check-in now clears the banner.
- **Barcodes:** UPC-A / EAN-13 / GTIN-14 / UPC-E normalized so cached products match offline; USDA lookup requires an exact GTIN match (no more first-result fallback); OFF parsing uses per-100 g energy only, drops products with no nutrition panel, sanitizes codes.
- **Scanner:** html5-qrcode bundled locally and precached (works offline, no CDN); camera no longer stays on if the sheet is closed while starting.
- **iOS:** food library filter keeps the keyboard up; weekly pace slider drags smoothly; logging rolls to the new day after midnight.
- **Units:** tape measurements stored in inches and converted for display/CSV (neck added to CSV); water +250 ml adds 250 ml.
- **Added:** Favorites (★), Recent and Frequent sections in the Add sheet; searchable ingredient picker with live per-serving totals for saved meals; Ca/Fe/Vit D on custom foods; sex-specific iron/potassium targets; 14-day backup reminder (openGAINS parity); node test suite.
- USDA API key is excluded from JSON backups; service worker falls back to cache after 2.5 s on weak signal.

### v2 — 2026-11-22
- Direct **Open Food Facts** text search & barcode lookup (no API key required)
- Direct **USDA FoodData Central** search & barcode fallback via local-only API key setting
- Camera **Barcode & QR Code Scanner** (native `BarcodeDetector` + automatic iOS Safari `html5-qrcode` fallback + manual input)
- Automatic local caching of online/scanned foods for offline reuse

### v1 — 2026-11-22
- Initial offline-first PWA release matching the **openGAINS** gray & dark-muted-purple design system
