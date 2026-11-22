// core.test.js — run with: node --test   (Node 18+; no dependencies)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');

const foods = C.seedFoods();
const F = Object.fromEntries(foods.map(f => [f.id, f]));
const rice = foods.find(f => f.name.startsWith('White Rice'));
const today = C.dateKey();
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (±${tol})`);

/** 28-day cut: true TDEE ~2800, eating `kcal`/day, ~1 lb/wk loss with scale noise */
function simulate(kcal = 2300) {
  const weights = [], logs = {};
  let w = 190;
  const start = C.addDays(today, -28);
  for (let i = 0; i < 28; i++) {
    const dk = C.addDays(start, i);
    w -= 500 / 3500;
    weights.push({ date: dk, weightLb: +(w + Math.sin(i * 1.7) * 1.2).toFixed(1) });
    logs[dk] = [{ foodId: rice.id, grams: kcal / (rice.kcal / 100), snap: C.snapFood(rice) }];
  }
  return { weights, logs };
}
const prof = { sex: 'male', age: 26, heightIn: 70, startWeightLb: 190, bfPct: '', activity: 'moderate' };

test('seed foods have unique ids', () => {
  assert.equal(new Set(foods.map(f => f.id)).size, foods.length);
});

test('entry snapshot is immune to later food edits and deletion', () => {
  const food = Object.assign({}, rice);
  const entry = { foodId: food.id, grams: 200, snap: C.snapFood(food) };
  const before = C.dayTotals([entry], { [food.id]: food }).kcal;
  food.kcal = 999;
  assert.equal(C.dayTotals([entry], { [food.id]: food }).kcal, before);
  assert.equal(C.dayTotals([entry], {}).kcal, before);
  assert.equal(C.entryName(entry, {}), food.name);
});

test('legacy entry without snapshot falls back to live food; orphan yields 0 not NaN', () => {
  assert.ok(C.dayTotals([{ foodId: rice.id, grams: 100 }], F).kcal > 0);
  assert.equal(C.dayTotals([{ foodId: 'gone', grams: 100 }], F).kcal, 0);
  assert.equal(C.entryName({ foodId: 'gone' }, F), 'Unknown food');
});

test('coachDayStatus: today open, partial vs auto vs manual overrides', () => {
  const y = C.addDays(today, -1);
  assert.equal(C.coachDayStatus(today, 2500, {}), 'open');
  assert.equal(C.coachDayStatus(C.addDays(today, 1), 2500, {}), 'open');
  assert.equal(C.coachDayStatus(y, 900, { planKcal: 2300 }), 'partial');
  assert.equal(C.coachDayStatus(y, 1200, { planKcal: 2300 }), 'auto');
  assert.equal(C.coachDayStatus(y, 900, { planKcal: 2300, dayMeta: { [y]: 'done' } }), 'done');
  assert.equal(C.coachDayStatus(y, 2300, { dayMeta: { [y]: 'skip' } }), 'skip');
  assert.equal(C.coachDayStatus(y, 0, {}), 'empty');
});

test('expenditure: partial days and today no longer drag the estimate down', () => {
  const { weights, logs } = simulate();
  const opts = { planKcal: 2300 };
  const base = C.estimateExpenditure(prof, weights, logs, F, opts).tdee;
  assert.ok(base > 2600 && base < 2950, 'baseline recovers ~2800: ' + base);
  logs[today] = [{ foodId: rice.id, grams: 600 / (rice.kcal / 100) }];
  for (let i = 1; i <= 4; i++) logs[C.addDays(today, -i * 3)] = [{ foodId: rice.id, grams: 1100 / (rice.kcal / 100) }];
  const after = C.estimateExpenditure(prof, weights, logs, F, opts).tdee;
  near(after, base, 60, 'partial days excluded');
});

test('expenditure: user-excluded day is ignored even if large', () => {
  const { weights, logs } = simulate();
  const dk = C.addDays(today, -2);
  logs[dk] = [{ foodId: rice.id, grams: 6000 / (rice.kcal / 100) }];
  const a = C.estimateExpenditure(prof, weights, logs, F, { planKcal: 2300, dayMeta: { [dk]: 'skip' } }).tdee;
  const { logs: clean } = simulate();
  delete clean[dk];
  const b = C.estimateExpenditure(prof, weights, clean, F, { planKcal: 2300 }).tdee;
  assert.equal(a, b);
});

test('barcode normalization: UPC-A / EAN-13 / GTIN-14 are the same product', () => {
  assert.ok(C.sameBarcode('012345678905', '0012345678905'));
  assert.ok(C.sameBarcode('00012345678905', '012345678905'));
  assert.ok(!C.sameBarcode('012345678905', '012345678912'));
  assert.ok(!C.sameBarcode('', ''));
  assert.equal(C.barcodeCandidates('012345678905')[0], '0012345678905');
});

test('UPC-E expands to UPC-A (textbook cases)', () => {
  assert.equal(C.upcEtoA('01234565'), '012345000065');
  assert.equal(C.upcEtoA('04252614'), '042100005264');
  assert.equal(C.upcEtoA('22345678'), null);
  assert.ok(C.barcodeCandidates('01234565').includes('0012345000065'));
});

test('parseOFFProduct: per-100g energy only, kJ fallback, empty panels dropped, code sanitized', () => {
  const kj = C.parseOFFProduct({ code: "12'3", product_name: 'X', nutriments: { energy_100g: 418.4, proteins_100g: 5 } });
  assert.equal(kj.kcal, 100);
  assert.equal(kj.id, 'off_123');
  const perServingOnly = C.parseOFFProduct({ code: '1', product_name: 'Y', nutriments: { 'energy-kcal': 250, proteins_100g: 10 } });
  assert.equal(perServingOnly.kcal, 0);
  assert.equal(C.parseOFFProduct({ code: '1', product_name: 'Z', nutriments: {} }), null);
  const salt = C.parseOFFProduct({ code: '2', product_name: 'S', nutriments: { 'energy-kcal_100g': 50, salt_100g: 1 } });
  assert.equal(salt.na, 400);
});

test('parseUSDAFood: maps nutrient ids, converts IU vitamin D, drops empty', () => {
  const f = C.parseUSDAFood({
    fdcId: 123, description: 'Oats', gtinUpc: '0001-234',
    foodNutrients: [{ nutrientId: 1008, value: 380 }, { nutrientId: 1003, value: 13 }, { nutrientId: 1114, value: 400, unitName: 'IU' }],
  });
  assert.equal(f.id, 'usda_123'); assert.equal(f.kcal, 380); assert.equal(f.vitd, 10); assert.equal(f.barcode, '0001234');
  assert.equal(C.parseUSDAFood({ fdcId: 1, description: 'Water', foodNutrients: [] }), null);
});

test('parseScanPayload: barcodes, GS1 links, JSON QR with sanitized category', () => {
  assert.deepEqual(C.parseScanPayload('012345678905'), { kind: 'barcode', code: '012345678905' });
  assert.equal(C.parseScanPayload('https://id.gs1.org/01/00012345678905').code, '00012345678905');
  const q = C.parseScanPayload('{"name":"Bar","kcal":200,"p":20,"cat":"<img>"}');
  assert.equal(q.kind, 'food'); assert.equal(q.food.cat, 'Other');
  assert.equal(C.parseScanPayload('hello').kind, 'text');
});

test('recentFoods: most-recent-first, frequent needs ≥2 uses', () => {
  const y = C.addDays(today, -1), y2 = C.addDays(today, -2);
  const logs = {
    [y2]: [{ foodId: 'a' }, { foodId: 'b' }],
    [y]: [{ foodId: 'a' }, { foodId: 'c' }, { quick: true, name: 'x' }],
    [today]: [{ foodId: 'd' }],
  };
  const r = C.recentFoods(logs);
  assert.deepEqual(r.recent, ['d', 'c', 'a', 'b']);
  assert.deepEqual(r.frequent, ['a']);
});

test('biometrics CSV converts stored inches to cm in metric', () => {
  const csv = C.biometricsToCSV([{ date: '2026-11-01', weightLb: 180, waist: 32 }], 'kg');
  assert.match(csv, /Waist \(cm\)/);
  assert.match(csv, /,81\.3,/);
});

test('micro targets are sex-specific', () => {
  assert.equal(C.microTargets('male').fe.target, 8);
  assert.equal(C.microTargets('female').fe.target, 18);
  assert.equal(C.microTargets('female').k.target, 2600);
  assert.equal(C.MICRO_TARGETS.fe.target, 14, 'base table untouched');
});

test('buildPlan macros reconcile to the calorie target', () => {
  for (const split of Object.keys(C.SPLITS)) {
    const p = C.buildPlan(prof, { mode: 'lose', ratePctWk: 0.75, protTier: 'high', split }, 2800, 190, '');
    near(p.p * 4 + p.c * 4 + p.f * 9, p.kcal, 25, split);
  }
});
