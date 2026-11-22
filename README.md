# openMACROS

A private, offline-first nutrition tracker and adaptive macro coach — built as a companion PWA to **openGAINS**. Installs to your home screen, runs with no account, no server, and no network, and keeps every meal and weigh-in local on your device.

Combines **MacroFactor**-style adaptive expenditure coaching (EWMA weight trend + non-punitive weekly check-ins) with **Cronometer**-style whole-food accuracy (macros, key micronutrients, custom recipes, and body composition tracking).

---

## Structure

Five source files, no build step, no dependencies.

```
index.html              shell, all styles, app mount point
core.js                 pure nutrition & adaptive coaching logic (node-testable)
app.js                  state, rendering, actions, localStorage
sw.js                   service worker, network-first with offline fallback
manifest.webmanifest    PWA metadata
icon-180/192/512.png    home screen icons
```

Four tabs: **Log**, **Plan**, **Body**, **Data**.

---

## Key Capabilities

- **Goal & Plan Builder**: Choose **Fat Loss**, **Dynamic Maintenance**, or **Muscle Gain**; set current body stats (with optional body fat %), target weight, weekly pace or target date, protein tier, and carb/fat split (Balanced, Lower Fat, Lower Carb, Keto).
- **Adaptive Expenditure & Weekly Check-In**: Smooths daily weigh-ins using linear interpolation + EWMA trend weight, then blends your initial estimate (Katch-McArdle or Mifflin-St Jeor) toward observed energy expenditure from rolling food logs and trend weight change. Weekly check-ins propose updated calorie/macro targets without punitive "make-up" penalties.
- **Food & Meal Logging**: 60+ starter whole & fitness foods with serving/gram scaling, Quick Add, copy-from-yesterday, custom foods, multi-ingredient **Saved Meals / Recipes**, daily water tracking, and key micronutrients (Fiber, Sodium, Potassium, Calcium, Iron, Vitamin D).
- **Body Composition & Trends**: Track scale weight, smoothed trend weight, body fat % (including a built-in **US Navy** waist/neck/hip estimator), lean body mass, and tape measurements, with charts for Weight vs. Trend, Adaptive Expenditure, and 14-day Calorie Adherence.
- **Data Ownership**: Local `localStorage` (`openmacros.v1`), full Diary CSV and Biometrics CSV exports, and JSON backup/restore.

---

## Deploying

Static files — any HTTPS host works.

1. Upload the unzipped files loose to the repo root.
2. Enable GitHub Pages (or any static HTTPS host).
3. Open in Safari / Chrome → **Add to Home Screen**.
4. Launch once while online so the service worker caches it.

## Development

```bash
python3 -m http.server 8000
```

`core.js` runs directly under Node for testing:

```js
const C = require('./core.js');
C.estimateExpenditure(profile, weights, logs, foodById);
```
