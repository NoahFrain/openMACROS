/* core.js — pure nutrition & adaptive coaching logic (no DOM). Works in browser (window.Core) and node (module.exports). */
(function (root) {
  'use strict';

  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const CATS = ['Protein', 'Carbs', 'Fats', 'Dairy', 'Produce', 'Snacks', 'Other'];
  const ACTIVITY = [
    { k: 'sedentary', label: 'Sedentary', desc: 'Desk job, <5k steps/day', mult: 1.2 },
    { k: 'light', label: 'Lightly Active', desc: '5–8k steps or 1–3 workouts/wk', mult: 1.375 },
    { k: 'moderate', label: 'Moderately Active', desc: '8–10k steps + 3–5 workouts/wk', mult: 1.55 },
    { k: 'very', label: 'Very Active', desc: '10k+ steps + 5–6 hard workouts/wk', mult: 1.725 },
    { k: 'athlete', label: 'Athlete / Physical Job', desc: 'High daily movement + heavy training', mult: 1.9 },
  ];
  const SPLITS = {
    balanced: { label: 'Balanced', fatPct: 0.28 },
    lowfat: { label: 'Lower Fat', fatPct: 0.22 },
    lowcarb: { label: 'Lower Carb', fatPct: 0.36 },
    keto: { label: 'Keto (<35g C)', fatPct: 0.65, maxCarbs: 35 },
  };
  const PROT_TIERS = {
    mod: { label: 'Moderate', gPerLbLbm: 0.85, gPerLbBw: 0.72 },
    high: { label: 'High (Recommended)', gPerLbLbm: 1.0, gPerLbBw: 0.85 },
    extra: { label: 'Extra High', gPerLbLbm: 1.15, gPerLbBw: 1.0 },
  };
  const MICRO_TARGETS = {
    fiber: { label: 'Fiber', unit: 'g', target: 30, min: true },
    na: { label: 'Sodium', unit: 'mg', target: 2300, cap: true },
    k: { label: 'Potassium', unit: 'mg', target: 3400, min: true },
    ca: { label: 'Calcium', unit: 'mg', target: 1000, min: true },
    fe: { label: 'Iron', unit: 'mg', target: 14, min: true },
    vitd: { label: 'Vitamin D', unit: 'mcg', target: 15, min: true },
  };
  /** Adult DRI targets by sex (iron RDA 8 vs 18 mg, potassium AI 3400 vs 2600 mg) */
  function microTargets(sex) {
    const t = JSON.parse(JSON.stringify(MICRO_TARGETS));
    if (sex === 'female') { t.fe.target = 18; t.k.target = 2600; t.fiber.target = 25; }
    else { t.fe.target = 8; t.k.target = 3400; t.fiber.target = 38; }
    return t;
  }

  // Curated USDA-based whole & fitness food database (values per 100g)
  // name|cat|srvLabel|srvG|kcal|p|c|f|fiber|na|k|ca|fe|vitd
  const SEED_FOODS = `
Chicken Breast (Cooked)|Protein|4 oz|113|165|31|0|3.6|0|74|256|15|1.0|0.1
Chicken Thigh (Boneless, Cooked)|Protein|4 oz|113|195|26|0|9.5|0|88|240|12|1.3|0.1
Ground Beef 93/7 (Cooked)|Protein|4 oz|113|193|26|0|9.4|0|76|330|14|2.6|0.1
Ground Beef 85/15 (Cooked)|Protein|4 oz|113|250|25.5|0|16|0|72|318|18|2.4|0.1
Ground Turkey 93/7 (Cooked)|Protein|4 oz|113|189|24|0|10|0|92|278|21|1.5|0.2
Sirloin Steak (Lean, Cooked)|Protein|4 oz|113|201|29.5|0|8.4|0|56|358|12|2.1|0.1
Salmon (Atlantic, Cooked)|Protein|4 oz|113|206|22.1|0|12.4|0|61|384|15|0.3|13.1
Tuna (Canned in Water)|Protein|1 can (112g)|112|116|25.5|0|0.8|0|247|237|11|1.3|1.7
Shrimp (Cooked)|Protein|4 oz|113|99|24|0.2|0.3|0|111|259|70|0.5|0.1
Cod / White Fish (Cooked)|Protein|4 oz|113|105|22.8|0|0.9|0|78|244|14|0.5|1.2
Whole Egg (Large)|Protein|1 egg (50g)|50|143|12.6|0.7|9.5|0|142|138|56|1.8|2.0
Liquid Egg Whites|Protein|100 g|100|52|10.9|0.7|0.2|0|166|163|7|0.1|0
Whey Protein Isolate|Protein|1 scoop (32g)|32|375|84|4|1.5|0|180|420|350|0.8|0
Casein Protein Powder|Protein|1 scoop (34g)|34|353|74|8.8|2.9|2|290|380|1400|1.5|0
Tofu (Extra Firm)|Protein|100 g|100|83|10|1.2|4.7|1|14|148|201|1.6|0
Tempeh|Protein|100 g|100|192|20.3|7.6|10.8|5|9|412|111|2.7|0
Greek Yogurt 0% (Plain)|Dairy|170 g|170|59|10.2|3.6|0.4|0|36|141|110|0.1|0
Greek Yogurt 2% (Plain)|Dairy|170 g|170|73|9.9|3.9|1.9|0|34|141|115|0.1|0
Cottage Cheese (Low Fat 2%)|Dairy|113 g|113|81|10.5|4.8|2.3|0|308|125|111|0.1|0
Milk (2% Reduced Fat)|Dairy|1 cup (244g)|244|50|3.3|4.8|2.0|0|47|140|120|0|1.2
Milk (Skim / Nonfat)|Dairy|1 cup (245g)|245|34|3.4|5.0|0.1|0|42|156|122|0|1.2
Unsweetened Almond Milk|Dairy|1 cup (240g)|240|15|0.6|0.6|1.1|0.4|72|31|188|0.3|1.0
Cheddar Cheese|Dairy|1 oz (28g)|28|403|22.9|3.1|33.3|0|653|76|710|0.1|0.6
Mozzarella (Part-Skim)|Dairy|1 oz (28g)|28|254|24.3|2.8|15.9|0|619|84|782|0.2|0.4
White Rice (Cooked)|Carbs|150 g|150|130|2.7|28.2|0.3|0.4|1|35|10|1.2|0
Brown Rice (Cooked)|Carbs|150 g|150|112|2.3|23.5|0.8|1.8|1|79|10|0.5|0
Jasmine Rice (Dry)|Carbs|75 g|75|356|6.7|80|0.6|1.3|2|115|10|0.8|0
Rolled Oats (Dry)|Carbs|50 g|50|379|13.2|67.7|6.5|10.1|6|362|52|4.3|0
Cream of Rice (Dry)|Carbs|45 g|45|367|6.7|82|0.5|0.9|5|80|10|0.8|0
Sweet Potato (Baked)|Carbs|150 g|150|90|2.0|20.7|0.2|3.3|36|475|38|0.7|0
Russet Potato (Baked)|Carbs|150 g|150|93|2.5|21.2|0.1|2.2|10|535|15|1.1|0
Quinoa (Cooked)|Carbs|150 g|150|120|4.4|21.3|1.9|2.8|7|172|17|1.5|0
Whole Wheat Bread|Carbs|1 slice (32g)|32|252|12.5|42.7|3.5|6.0|450|254|161|2.5|0
Sourdough Bread|Carbs|1 slice (45g)|45|274|10.8|51.9|2.1|2.2|602|117|52|3.9|0
Pasta (Cooked)|Carbs|140 g|140|158|5.8|30.9|0.9|1.8|1|44|7|1.3|0
Bagel (Plain)|Carbs|1 bagel (98g)|98|257|10.0|50.5|1.6|2.3|430|101|18|3.6|0
Flour Tortilla (Medium)|Carbs|1 tortilla (45g)|45|312|8.7|51.6|7.7|3.3|680|132|125|3.3|0
Black Beans (Cooked)|Carbs|130 g|130|132|8.9|23.7|0.5|8.7|1|355|27|2.1|0
Lentils (Cooked)|Carbs|150 g|150|116|9.0|20.1|0.4|7.9|2|369|19|3.3|0
Olive Oil (Extra Virgin)|Fats|1 tbsp (14g)|14|884|0|0|100|0|2|1|1|0.6|0
Butter (Salted)|Fats|1 tbsp (14g)|14|717|0.9|0.1|81.1|0|643|24|24|0|0
Avocado|Fats|1/2 med (75g)|75|160|2.0|8.5|14.7|6.7|7|485|12|0.6|0
Peanut Butter (Natural)|Fats|2 tbsp (32g)|32|588|25.1|20|50.4|6.0|17|649|43|1.9|0
Almond Butter|Fats|2 tbsp (32g)|32|614|21|18.8|55.5|10.3|7|748|347|3.5|0
Almonds (Raw)|Fats|1 oz (28g)|28|579|21.2|21.6|49.9|12.5|1|733|269|3.7|0
Walnuts|Fats|1 oz (28g)|28|654|15.2|13.7|65.2|6.7|2|441|98|2.9|0
Chia Seeds|Fats|2 tbsp (28g)|28|486|16.5|42.1|30.7|34.4|16|407|631|7.7|0
Banana|Produce|1 medium (118g)|118|89|1.1|22.8|0.3|2.6|1|358|5|0.3|0
Blueberries|Produce|100 g|100|57|0.7|14.5|0.3|2.4|1|77|6|0.3|0
Strawberries|Produce|150 g|150|32|0.7|7.7|0.3|2.0|1|153|16|0.4|0
Apple|Produce|1 medium (182g)|182|52|0.3|13.8|0.2|2.4|1|107|6|0.1|0
Orange|Produce|1 medium (131g)|131|47|0.9|11.8|0.1|2.4|0|181|40|0.1|0
Broccoli (Steamed)|Produce|100 g|100|35|2.4|7.2|0.4|3.3|41|293|40|0.7|0
Spinach (Raw)|Produce|60 g|60|23|2.9|3.6|0.4|2.2|79|558|99|2.7|0
Asparagus (Cooked)|Produce|100 g|100|22|2.4|4.1|0.2|2.0|14|224|23|0.9|0
Mixed Salad Greens|Produce|85 g|85|17|1.5|3.3|0.2|1.8|28|240|36|0.9|0
Bell Pepper (Red)|Produce|100 g|100|31|1.0|6.0|0.3|2.1|4|211|7|0.4|0
Carrots (Raw)|Produce|100 g|100|41|0.9|9.6|0.2|2.8|69|320|33|0.3|0
Rice Cakes (Plain)|Snacks|2 cakes (18g)|18|387|8.2|81.5|2.8|4.2|326|290|11|1.5|0
Dark Chocolate 85%|Snacks|20 g|20|598|7.8|45.9|42.6|10.9|20|715|73|11.9|0
Honey|Snacks|1 tbsp (21g)|21|304|0.3|82.4|0|0.2|4|52|6|0.4|0
Protein Bar (Standard)|Snacks|1 bar (60g)|60|333|33.3|36.7|11.7|13.3|333|200|150|1.8|0
`.trim().split('\n');

  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const round1 = (x) => Math.round(x * 10) / 10;
  const round0 = (x) => Math.round(x);

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(t) {
    const d = (t instanceof Date) ? t : new Date(t || Date.now());
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseDateKey(k) {
    const [y, m, d] = String(k).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0).getTime();
  }
  function addDays(k, n) { return dateKey(parseDateKey(k) + n * 86400000); }
  function daysBetween(k1, k2) { return Math.round((parseDateKey(k2) - parseDateKey(k1)) / 86400000); }

  function seedFoods() {
    return SEED_FOODS.map(line => {
      const [name, cat, srvLabel, srvG, kcal, p, c, f, fiber, na, k, ca, fe, vitd] = line.split('|');
      return {
        id: 'f_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 22),
        name, cat, srvLabel, srvG: +srvG,
        kcal: +kcal, p: +p, c: +c, f: +f,
        fiber: +fiber, na: +na, k: +k, ca: +ca, fe: +fe, vitd: +vitd,
      };
    });
  }

  /** Compute nutrition for a given gram weight of a food */
  function foodNutrients(food, grams) {
    if (!food || !(grams > 0)) return { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, na: 0, k: 0, ca: 0, fe: 0, vitd: 0 };
    const m = grams / 100;
    return {
      kcal: food.kcal * m, p: food.p * m, c: food.c * m, f: food.f * m,
      fiber: (food.fiber || 0) * m, na: (food.na || 0) * m, k: (food.k || 0) * m,
      ca: (food.ca || 0) * m, fe: (food.fe || 0) * m, vitd: (food.vitd || 0) * m,
    };
  }

  /** Sum an array of nutrient objects */
  function sumNutrients(list) {
    const out = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, na: 0, k: 0, ca: 0, fe: 0, vitd: 0 };
    for (const n of list) {
      if (!n) continue;
      for (const k in out) out[k] += (+n[k] || 0);
    }
    return out;
  }

  const NKEYS = ['kcal', 'p', 'c', 'f', 'fiber', 'na', 'k', 'ca', 'fe', 'vitd'];

  /** Frozen per-100g copy of a food, stored on each log entry so later edits/deletes never rewrite history */
  function snapFood(food) {
    if (!food) return null;
    const s = { name: food.name };
    for (const k of NKEYS) s[k] = +food[k] || 0;
    return s;
  }

  /** Nutrients for one log entry: quick entry → absolute values; food entry → snapshot (preferred) or live food */
  function entryNutrients(e, foodById) {
    if (!e) return foodNutrients(null, 0);
    if (e.quick) return { kcal: +e.kcal || 0, p: +e.p || 0, c: +e.c || 0, f: +e.f || 0, fiber: +e.fiber || 0, na: 0, k: 0, ca: 0, fe: 0, vitd: 0 };
    return foodNutrients(e.snap || (foodById && foodById[e.foodId]), e.grams);
  }
  function entryName(e, foodById) {
    if (e.quick) return e.name || 'Quick Add';
    return (e.snap && e.snap.name) || ((foodById && foodById[e.foodId]) || {}).name || 'Unknown food';
  }

  /** Compute totals for a day's log entries */
  function dayTotals(entries, foodById) {
    return sumNutrients((entries || []).map(e => entryNutrients(e, foodById)));
  }

  // ---------- Coaching day eligibility ----------
  /** Which days feed the expenditure model.
   * meta: 'done' (user marked complete) | 'skip' (user excluded) | undefined (auto).
   * Auto days count only when finished (before today) and ≥ max(400, 50% of plan kcal). */
  function coachDayStatus(dk, kcal, opts) {
    opts = opts || {};
    const today = opts.today || dateKey();
    const st = (opts.dayMeta || {})[dk];
    if (dk >= today) return 'open';
    if (st === 'skip') return 'skip';
    if (st === 'done') return kcal > 0 ? 'done' : 'empty';
    if (!(kcal > 0)) return 'empty';
    const minK = opts.planKcal > 0 ? Math.max(400, opts.planKcal * 0.5) : 400;
    return kcal >= minK ? 'auto' : 'partial';
  }
  const COUNTS = { done: true, auto: true };

  // ---------- Recents / Frequents ----------
  /** Returns { recent: [foodId], frequent: [foodId] } from finished + current logs */
  function recentFoods(logsByDate, opts) {
    opts = opts || {};
    const limit = opts.limit || 8, days = opts.days || 60, today = opts.today || dateKey();
    const cutoff = addDays(today, -days);
    const recent = [], seen = new Set(), counts = {};
    for (const dk of Object.keys(logsByDate || {}).sort().reverse()) {
      if (dk > today) continue;
      const list = (logsByDate[dk] || []).slice().reverse();
      for (const e of list) {
        if (e.quick || !e.foodId) continue;
        if (!seen.has(e.foodId)) { seen.add(e.foodId); if (recent.length < limit) recent.push(e.foodId); }
        if (dk >= cutoff) counts[e.foodId] = (counts[e.foodId] || 0) + 1;
      }
    }
    const frequent = Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
    return { recent, frequent };
  }

  // ---------- Barcodes ----------
  const digits = (s) => String(s ?? '').replace(/\D/g, '');
  /** Canonical comparison key: digits with leading zeros stripped (UPC-A 12, EAN-13, GTIN-14 all collapse) */
  function barcodeKey(code) { const d = digits(code); return d.replace(/^0+/, '') || d; }
  function sameBarcode(a, b) { return !!digits(a) && !!digits(b) && barcodeKey(a) === barcodeKey(b); }
  /** Expand an 8-digit UPC-E to 12-digit UPC-A (null if not UPC-E shaped) */
  function upcEtoA(code) {
    const d = digits(code);
    if (d.length !== 8 || (d[0] !== '0' && d[0] !== '1')) return null;
    const [n, a, b, c, e, f, g, chk] = d.split('');
    let body;
    if (g <= '2') body = a + b + g + '0000' + c + e + f;
    else if (g === '3') body = a + b + c + '00000' + e + f;
    else if (g === '4') body = a + b + c + e + '00000' + f;
    else body = a + b + c + e + f + '0000' + g;
    return n + body + chk;
  }
  /** Codes to try against online databases, most likely first (EAN-13 form, EAN-8 as-is, UPC-E expansion) */
  function barcodeCandidates(code) {
    const d = digits(code);
    if (!d) return [];
    const out = [];
    const push = (x) => { if (x && !out.includes(x)) out.push(x); };
    if (d.length === 8) push(d);
    const s = d.replace(/^0+/, '');
    if (s.length <= 13 && d.length !== 8) push(s.padStart(13, '0'));
    const ua = upcEtoA(d);
    if (ua) push(ua.padStart(13, '0'));
    push(d);
    return out;
  }

  /** Compute totals for a saved recipe/meal */
  function recipeTotals(recipe, foodById) {
    const total = sumNutrients((recipe.items || []).map(it => foodNutrients(foodById[it.foodId], it.grams)));
    const srv = Math.max(1, +recipe.servings || 1);
    const perServing = {};
    for (const k in total) perServing[k] = total[k] / srv;
    return { total, perServing };
  }

  // ---------- Body Composition & Units ----------
  const LB_PER_KG = 2.20462262;
  const CM_PER_IN = 2.54;
  const toLb = (val, unit) => unit === 'kg' ? val * LB_PER_KG : val;
  const fromLb = (lb, unit) => unit === 'kg' ? lb / LB_PER_KG : lb;
  const toIn = (val, unit) => unit === 'kg' ? val / CM_PER_IN : val;
  const fromIn = (inch, unit) => unit === 'kg' ? inch * CM_PER_IN : inch;

  /** US Navy body fat % estimate (inputs in inches) */
  function navyBodyFat({ sex, heightIn, waistIn, neckIn, hipIn }) {
    if (!(heightIn > 0) || !(waistIn > 0) || !(neckIn > 0)) return null;
    if (sex === 'female') {
      if (!(hipIn > 0) || (waistIn + hipIn - neckIn) <= 0) return null;
      const bf = 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
      return round1(clamp(bf, 8, 55));
    }
    if ((waistIn - neckIn) <= 0) return null;
    const bf = 86.010 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
    return round1(clamp(bf, 4, 50));
  }

  function bodyComp(weight, bfPct) {
    if (!(weight > 0) || !(bfPct > 0 && bfPct < 70)) return { lbm: null, fm: null };
    const fm = weight * (bfPct / 100);
    return { lbm: round1(weight - fm), fm: round1(fm) };
  }

  // ---------- Initial Expenditure (TDEE) ----------
  function activityMult(key) {
    const a = ACTIVITY.find(x => x.k === key);
    return a ? a.mult : 1.55;
  }

  /** Estimate initial TDEE via Katch-McArdle (if BF% known) or Mifflin-St Jeor */
  function initialTDEE(profile, latestWeightLb, latestBf) {
    const wLb = latestWeightLb || profile.startWeightLb || 175;
    const wKg = wLb / LB_PER_KG;
    const hCm = (profile.heightIn || 69) * CM_PER_IN;
    const age = profile.age || 30;
    const bf = (latestBf > 3 && latestBf < 60) ? latestBf : (profile.bfPct > 3 && profile.bfPct < 60 ? profile.bfPct : null);
    let bmr;
    if (bf) {
      const lbmKg = wKg * (1 - bf / 100);
      bmr = 370 + 21.6 * lbmKg;
    } else {
      bmr = 10 * wKg + 6.25 * hCm - 5 * age + (profile.sex === 'female' ? -161 : 5);
    }
    return round0(clamp(bmr * activityMult(profile.activity), 1200, 5500));
  }

  // ---------- Weight Trend (Linear Interpolation + EWMA, MacroFactor-style) ----------
  /** entries: [{ date:'YYYY-MM-DD', weightLb, bf, ... }]
   * Returns chronological daily array [{ date, scale (number|null), interp, trend }] */
  function trendWeights(entries) {
    const valid = (entries || []).filter(e => e.weightLb > 0 && e.date).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (!valid.length) return [];
    // Deduplicate same-day entries (keep latest)
    const byDate = {};
    for (const e of valid) byDate[e.date] = e.weightLb;
    const dates = Object.keys(byDate).sort();
    const first = dates[0], last = dates[dates.length - 1];
    const span = Math.max(0, daysBetween(first, last));
    const daily = [];
    // Build full calendar span with linear interpolation across missing days
    let prevIdx = 0;
    for (let i = 0; i <= span; i++) {
      const dk = addDays(first, i);
      if (dk in byDate) {
        daily.push({ date: dk, scale: byDate[dk], interp: byDate[dk] });
        prevIdx = dates.indexOf(dk);
      } else {
        const d0 = dates[prevIdx], d1 = dates[Math.min(prevIdx + 1, dates.length - 1)];
        const totalGap = Math.max(1, daysBetween(d0, d1));
        const frac = daysBetween(d0, dk) / totalGap;
        const val = byDate[d0] + (byDate[d1] - byDate[d0]) * frac;
        daily.push({ date: dk, scale: null, interp: val });
      }
    }
    // EWMA smoothing (alpha = 0.14 balances responsiveness and noise rejection)
    const alpha = 0.14;
    let tr = daily[0].interp;
    for (let i = 0; i < daily.length; i++) {
      tr = i === 0 ? daily[0].interp : (alpha * daily[i].interp + (1 - alpha) * tr);
      daily[i].trend = round1(tr);
    }
    return daily;
  }

  // ---------- Adaptive Expenditure Algorithm ----------
  /** Computes adaptive TDEE from smoothed trend weight + rolling logged calories.
   * Returns { tdee, initial, observed, confidence (0..1), windowDays, avgIntake, weeklyTrendDeltaLb, series: [{date, tdee}] } */
  function estimateExpenditure(profile, weights, logsByDate, foodById, opts) {
    const tr = trendWeights(weights);
    const latestW = tr.length ? tr[tr.length - 1].trend : (profile.startWeightLb || 175);
    const latestBf = (weights || []).slice().sort((a, b) => b.date.localeCompare(a.date)).find(w => w.bf > 0)?.bf || profile.bfPct;
    const init = initialTDEE(profile, latestW, latestBf);

    // Only finished, complete-looking (or user-confirmed) days feed the model — see coachDayStatus
    const intakeByDate = {};
    for (const dk in (logsByDate || {})) {
      const tot = dayTotals(logsByDate[dk], foodById);
      if (COUNTS[coachDayStatus(dk, tot.kcal, opts)]) intakeByDate[dk] = tot.kcal;
    }

    if (tr.length < 7) {
      return { tdee: init, initial: init, observed: null, confidence: 0, windowDays: tr.length, avgIntake: null, weeklyTrendDeltaLb: 0, series: tr.length ? [{ date: tr[tr.length - 1].date, tdee: init }] : [] };
    }

    // Build rolling expenditure series across trend days
    const series = [];
    let lastEst = init;
    let lastMeta = { observed: null, confidence: 0, avgIntake: null, weeklyDelta: 0, loggedDays: 0 };

    for (let i = 6; i < tr.length; i++) {
      const winStart = Math.max(0, i - 20); // up to 21-day window
      const slice = tr.slice(winStart, i + 1);
      const spanDays = Math.max(1, slice.length - 1);
      const cals = slice.map(d => intakeByDate[d.date]).filter(v => v != null);
      if (cals.length >= 4 && spanDays >= 6) {
        const avgIn = cals.reduce((a, b) => a + b, 0) / cals.length;
        const deltaLb = slice[slice.length - 1].trend - slice[0].trend;
        const dailyEnergyDelta = (deltaLb * 3500) / spanDays;
        const rawObs = clamp(avgIn - dailyEnergyDelta, 1100, 5800);
        // Confidence ramps from 0 at 4 logged days to 1.0 at 18+ logged days & 18+ day span
        const conf = clamp(Math.min(cals.length / 18, spanDays / 18), 0, 1);
        const blended = init * (1 - conf) + rawObs * conf;
        // Light temporal smoothing so TDEE curve stays stable
        lastEst = i === 6 ? blended : (0.28 * blended + 0.72 * lastEst);
        lastMeta = { observed: round0(rawObs), confidence: Math.round(conf * 100) / 100, avgIntake: round0(avgIn), weeklyDelta: round1((deltaLb / spanDays) * 7), loggedDays: cals.length };
      }
      series.push({ date: tr[i].date, tdee: round0(lastEst) });
    }

    return {
      tdee: round0(lastEst),
      initial: init,
      observed: lastMeta.observed,
      confidence: lastMeta.confidence,
      windowDays: Math.min(21, tr.length),
      avgIntake: lastMeta.avgIntake,
      weeklyTrendDeltaLb: lastMeta.weeklyDelta,
      series,
    };
  }

  // ---------- Plan & Macro Builder ----------
  /** goal: { mode:'lose'|'maintain'|'gain', targetWeightLb, ratePctWk, targetDate, protTier, split } */
  function buildPlan(profile, goal, tdee, currentWeightLb, bfPct) {
    const w = currentWeightLb || profile.startWeightLb || 175;
    const mode = goal.mode || 'maintain';
    let rateLbWk = 0;

    if (mode === 'maintain') {
      // Dynamic maintenance: if >1.5% away from target maintenance weight, apply gentle 0.25% corrective nudge
      if (goal.targetWeightLb > 0) {
        const diff = goal.targetWeightLb - w;
        if (Math.abs(diff) > w * 0.015) rateLbWk = clamp(diff * 0.25, -0.5, 0.5);
      }
    } else {
      const pct = clamp(goal.ratePctWk || (mode === 'lose' ? 0.75 : 0.25), 0.1, 1.5);
      rateLbWk = (mode === 'lose' ? -1 : 1) * (w * pct / 100);
    }

    const dailyDelta = (rateLbWk * 3500) / 7;
    const floorKcal = profile.sex === 'female' ? 1200 : 1450;
    const kcal = round0(clamp(tdee + dailyDelta, floorKcal, 5800));

    // Protein target anchored to LBM if BF% known, else body weight
    const tier = PROT_TIERS[goal.protTier || 'high'] || PROT_TIERS.high;
    const comp = bodyComp(w, bfPct || profile.bfPct);
    const protG = round0(clamp(comp.lbm ? comp.lbm * tier.gPerLbLbm : w * tier.gPerLbBw, 60, 320));
    const protKcal = protG * 4;

    const sp = SPLITS[goal.split || 'balanced'] || SPLITS.balanced;
    let fatG, carbG;
    if (sp.maxCarbs) {
      carbG = Math.min(sp.maxCarbs, Math.max(20, Math.floor((kcal - protKcal) / 4)));
      fatG = round0(Math.max(35, (kcal - protKcal - carbG * 4) / 9));
    } else {
      const minFatG = Math.max(40, round0(w * 0.25));
      fatG = round0(Math.max(minFatG, (kcal * sp.fatPct) / 9));
      const remKcal = Math.max(0, kcal - protKcal - fatG * 9);
      carbG = round0(remKcal / 4);
      // If carbs hit 0, scale fat slightly down to fit calorie target
      if (protKcal + fatG * 9 > kcal) {
        fatG = round0(Math.max(30, (kcal - protKcal) / 9));
      }
    }

    const fiberG = round0(clamp((kcal / 1000) * 14, 22, 50));

    // Projected ETA to target weight
    let weeksToGoal = null, etaDate = null;
    if (mode !== 'maintain' && goal.targetWeightLb > 0 && Math.abs(rateLbWk) > 0.05) {
      const remLb = goal.targetWeightLb - w;
      if ((mode === 'lose' && remLb < 0) || (mode === 'gain' && remLb > 0)) {
        weeksToGoal = round1(Math.abs(remLb / rateLbWk));
        etaDate = addDays(dateKey(), Math.round(weeksToGoal * 7));
      }
    }

    return {
      kcal, p: protG, c: carbG, f: fatG, fiber: fiberG,
      tdee: round0(tdee), dailyDelta: round0(dailyDelta), rateLbWk: round1(rateLbWk),
      weeksToGoal, etaDate, updatedAt: Date.now(),
    };
  }

  /** Weekly check-in proposal comparing current plan vs updated adaptive expenditure & timeline */
  function weeklyCheckIn(profile, goal, weights, logsByDate, foodById, currentPlan, opts) {
    const exp = estimateExpenditure(profile, weights, logsByDate, foodById, opts);
    const tr = trendWeights(weights);
    const latestW = tr.length ? tr[tr.length - 1].trend : (profile.startWeightLb || 175);
    const latestBf = (weights || []).slice().sort((a, b) => b.date.localeCompare(a.date)).find(w => w.bf > 0)?.bf || profile.bfPct;

    // If user set an explicit targetDate, recompute required ratePctWk from remaining days
    const adjGoal = Object.assign({}, goal);
    let timelineNote = '';
    if (goal.mode !== 'maintain' && goal.targetDate && goal.targetWeightLb > 0) {
      const remDays = daysBetween(dateKey(), goal.targetDate);
      const remLb = Math.abs(goal.targetWeightLb - latestW);
      if (remDays >= 7 && remLb > 0.2) {
        const reqLbWk = remLb / (remDays / 7);
        const reqPct = clamp((reqLbWk / latestW) * 100, 0.15, 1.35);
        adjGoal.ratePctWk = Math.round(reqPct * 100) / 100;
        if ((reqLbWk / latestW) * 100 > 1.35) timelineNote = 'Target date is aggressive — rate capped at 1.35% BW/wk for safety.';
      }
    }

    const proposed = buildPlan(profile, adjGoal, exp.tdee, latestW, latestBf);
    const prevKcal = currentPlan ? currentPlan.kcal : proposed.kcal;
    const diffKcal = proposed.kcal - prevKcal;
    let reason;
    if (exp.confidence < 0.15) {
      reason = 'Still gathering intake & weigh-in history — using baseline estimate. Log 5+ food days and 3+ weigh-ins per week for adaptive updates.';
    } else if (Math.abs(diffKcal) < 25) {
      reason = `Your trend weight (${exp.weeklyTrendDeltaLb >= 0 ? '+' : ''}${exp.weeklyTrendDeltaLb} lb/wk) is right on pace. Keeping targets steady.`;
    } else if (diffKcal > 0) {
      reason = `Adaptive expenditure rose to ${exp.tdee} kcal/day (trend ${exp.weeklyTrendDeltaLb >= 0 ? '+' : ''}${exp.weeklyTrendDeltaLb} lb/wk). Increasing daily budget by +${diffKcal} kcal.`;
    } else {
      reason = `Adaptive expenditure adjusted to ${exp.tdee} kcal/day (trend ${exp.weeklyTrendDeltaLb >= 0 ? '+' : ''}${exp.weeklyTrendDeltaLb} lb/wk). Adjusting daily budget by ${diffKcal} kcal.`;
    }
    if (timelineNote) reason += ' ' + timelineNote;

    return { exp, proposed, prevKcal, diffKcal, reason, latestW, latestBf };
  }

  // ---------- CSV Exports ----------
  function csvCell(v) { v = String(v ?? ''); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  function diaryToCSV(logsByDate, foodById) {
    const cols = ['Date', 'Meal', 'Food', 'Grams', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fiber (g)', 'Sodium (mg)', 'Potassium (mg)', 'Calcium (mg)', 'Iron (mg)', 'Vitamin D (mcg)'];
    const rows = [cols.join(',')];
    for (const dk of Object.keys(logsByDate || {}).sort()) {
      for (const e of (logsByDate[dk] || [])) {
        const n = entryNutrients(e, foodById);
        const name = entryName(e, foodById);
        rows.push([dk, e.meal || 'Snacks', name, e.quick ? '' : round1(e.grams), round0(n.kcal), round1(n.p), round1(n.c), round1(n.f), round1(n.fiber), round0(n.na), round0(n.k), round0(n.ca), round1(n.fe), round1(n.vitd)].map(csvCell).join(','));
      }
    }
    return rows.join('\n') + '\n';
  }

  function biometricsToCSV(weights, unit) {
    const tr = trendWeights(weights);
    const trMap = Object.fromEntries(tr.map(x => [x.date, x.trend]));
    const lu = unit === 'kg' ? 'cm' : 'in';
    const cols = ['Date', `Scale Weight (${unit})`, `Trend Weight (${unit})`, 'Body Fat (%)', `Lean Mass (${unit})`, `Waist (${lu})`, `Neck (${lu})`, `Chest (${lu})`, `Arms (${lu})`, `Hips (${lu})`, 'Note'];
    const rows = [cols.join(',')];
    // Tape measurements are stored in inches; convert for display
    const len = (v) => v > 0 ? round1(fromIn(+v, unit)) : '';
    for (const w of (weights || []).slice().sort((a, b) => a.date.localeCompare(b.date))) {
      const dispW = round1(fromLb(w.weightLb, unit));
      const dispT = trMap[w.date] ? round1(fromLb(trMap[w.date], unit)) : '';
      const comp = bodyComp(dispW, w.bf);
      rows.push([w.date, dispW, dispT, w.bf || '', comp.lbm || '', len(w.waist), len(w.neck), len(w.chest), len(w.arms), len(w.hips), w.note || ''].map(csvCell).join(','));
    }
    return rows.join('\n') + '\n';
  }


  // ---------- External Food DB & QR Parsers ----------
  /** Normalize an Open Food Facts product object into openMACROS food format (per 100g) */
  function parseOFFProduct(p) {
    if (!p || !p.nutriments) return null;
    const n = p.nutriments;
    const rawName = (p.product_name || p.product_name_en || "").trim();
    const brand = (p.brands || "").split(",")[0].trim();
    if (!rawName && !brand) return null;
    const name = brand && !rawName.toLowerCase().includes(brand.toLowerCase()) ? `${rawName || "Product"} (${brand})` : (rawName || brand);
    // Per-100g only: bare "energy-kcal" can be per-serving; energy_100g is kJ
    const kj = n["energy-kj_100g"] ?? n["energy_100g"];
    const kcal = (n["energy-kcal_100g"] != null ? +n["energy-kcal_100g"] : (kj != null ? +kj / 4.184 : 0)) || 0;
    const prot = +(n.proteins_100g ?? 0) || 0;
    const carb = +(n.carbohydrates_100g ?? 0) || 0;
    const fat = +(n.fat_100g ?? 0) || 0;
    if (!(kcal > 0) && !(prot + carb + fat > 0)) return null; // no usable nutrition panel
    const fiber = +(n.fiber_100g ?? 0) || 0;
    const naMg = n.sodium_100g != null ? (+n.sodium_100g * 1000) : (n.salt_100g != null ? +n.salt_100g * 400 : 0);
    const kMg = n.potassium_100g != null ? (+n.potassium_100g * 1000) : 0;
    const caMg = n.calcium_100g != null ? (+n.calcium_100g * 1000) : 0;
    const feMg = n.iron_100g != null ? (+n.iron_100g * 1000) : 0;
    let vitdMcg = 0;
    if (n["vitamin-d_100g"] != null) {
      const vd = +n["vitamin-d_100g"];
      vitdMcg = vd < 0.01 ? vd * 1e6 : vd; // OFF stores g in some entries, mcg in others
    }
    const srvG = (+p.serving_quantity > 0 && +p.serving_quantity <= 1000) ? round0(+p.serving_quantity) : 100;
    const srvLabel = (p.serving_size && String(p.serving_size).trim()) ? String(p.serving_size).trim().slice(0, 24) : `${srvG} g`;
    const code = digits(p.code); // crowd-sourced field; digits only (it ends up in ids/handlers)
    return {
      id: code ? ("off_" + code) : ("off_" + uid()),
      name: name.slice(0, 80),
      cat: "Other",
      srvLabel,
      srvG,
      kcal: round0(kcal), p: round1(prot), c: round1(carb), f: round1(fat),
      fiber: round1(fiber), na: round0(naMg), k: round0(kMg), ca: round0(caMg), fe: round1(feMg), vitd: round1(vitdMcg),
      barcode: code,
      source: "OFF",
    };
  }

  /** Normalize a USDA FoodData Central search item into openMACROS food format (per 100g) */
  function parseUSDAFood(item) {
    if (!item || !item.description) return null;
    const nuts = item.foodNutrients || [];
    const getN = (ids, nums) => {
      const hit = nuts.find(x => ids.includes(x.nutrientId) || nums.includes(String(x.nutrientNumber || "")));
      return hit ? (+hit.value || 0) : 0;
    };
    const kcal = getN([1008, 2047, 2048], ["208"]);
    const prot = getN([1003], ["203"]);
    const carb = getN([1005], ["205"]);
    const fat = getN([1004], ["204"]);
    const fiber = getN([1079], ["291"]);
    const na = getN([1093], ["307"]);
    const k = getN([1092], ["306"]);
    const ca = getN([1087], ["301"]);
    const fe = getN([1089], ["303"]);
    const vdHit = nuts.find(x => x.nutrientId === 1114 || String(x.nutrientNumber || "") === "328");
    const vitd = vdHit ? ((vdHit.unitName === "IU") ? (+vdHit.value / 40) : (+vdHit.value || 0)) : 0;

    const brand = (item.brandName || item.brandOwner || "").trim();
    const desc = String(item.description).trim();
    const name = brand && !desc.toLowerCase().includes(brand.toLowerCase()) ? `${desc} (${brand})` : desc;
    const srvG = (+item.servingSize > 0 && +item.servingSize <= 1000 && (!item.servingSizeUnit || /^(g|ml)$/i.test(item.servingSizeUnit))) ? round0(+item.servingSize) : 100;
    const srvLabel = item.householdServingFullText ? String(item.householdServingFullText).trim().slice(0, 24) : `${srvG} g`;
    if (!(kcal > 0) && !(prot + carb + fat > 0)) return null;
    const code = digits(item.gtinUpc);
    const fdc = digits(item.fdcId);
    return {
      id: fdc ? ("usda_" + fdc) : ("usda_" + uid()),
      name: name.slice(0, 80),
      cat: "Other",
      srvLabel,
      srvG,
      kcal: round0(kcal), p: round1(prot), c: round1(carb), f: round1(fat),
      fiber: round1(fiber), na: round0(na), k: round0(k), ca: round0(ca), fe: round1(fe), vitd: round1(vitd),
      barcode: code,
      source: "USDA",
    };
  }

  /** Interpret a scanned barcode or QR payload */
  function parseScanPayload(raw) {
    const s = String(raw || "").trim();
    if (!s) return { kind: "empty" };
    // Pure numeric UPC/EAN barcode (6 to 14 digits)
    if (/^\d{6,14}$/.test(s)) return { kind: "barcode", code: s };
    // JSON food payload in a QR code
    if (s.startsWith("{") && s.endsWith("}")) {
      try {
        const j = JSON.parse(s);
        if (j && (j.kcal != null || j.p != null) && j.name) {
          return {
            kind: "food",
            food: {
              id: "qr_" + uid(), name: String(j.name).slice(0, 80), cat: CATS.includes(j.cat) ? j.cat : "Other",
              srvLabel: String(j.srvLabel || "1 serving").slice(0, 24), srvG: +j.srvG > 0 ? +j.srvG : 100,
              kcal: +j.kcal || 0, p: +j.p || 0, c: +j.c || 0, f: +j.f || 0,
              fiber: +j.fiber || 0, na: +j.na || 0, k: +j.k || 0, ca: +j.ca || 0, fe: +j.fe || 0, vitd: +j.vitd || 0,
              source: "QR",
            },
          };
        }
      } catch (e) { }
    }
    // URL containing an Open Food Facts or GS1 Digital Link GTIN/barcode (8-14 digits)
    const m = s.match(/(?:product\/|\/01\/|barcode=|gtin=)(\d{8,14})/i);
    if (m) return { kind: "barcode", code: m[1] };
    return { kind: "text", text: s };
  }

  const api = {
    MEALS, CATS, ACTIVITY, SPLITS, PROT_TIERS, MICRO_TARGETS, microTargets, NKEYS,
    uid, clamp, round0, round1, dateKey, parseDateKey, addDays, daysBetween,
    LB_PER_KG, CM_PER_IN, toLb, fromLb, toIn, fromIn,
    seedFoods, foodNutrients, sumNutrients, dayTotals, recipeTotals,
    snapFood, entryNutrients, entryName, coachDayStatus, recentFoods,
    barcodeKey, sameBarcode, upcEtoA, barcodeCandidates,
    navyBodyFat, bodyComp, initialTDEE, trendWeights, estimateExpenditure,
    buildPlan, weeklyCheckIn, diaryToCSV, biometricsToCSV, parseOFFProduct, parseUSDAFood, parseScanPayload,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
