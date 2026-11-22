/* app.js — openMACROS UI. State lives in localStorage under KEY. */
(function () {
  'use strict';
  const C = window.Core;
  const KEY = 'openmacros.v1';
  const BUILD = 'v1 · 2026-11-22';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r0 = (x) => Math.round(+x || 0);
  const r1 = (x) => Math.round((+x || 0) * 10) / 10;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const ICONS = {
    log: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="18.5" cy="18" r="2.5"/></svg>',
    plan: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5"/></svg>',
    body: '<svg viewBox="0 0 24 24"><path d="M4 19h16M5 15l4.5-4.5 3.5 3 6-7"/><path d="M15.5 6.5H19V10"/></svg>',
    data: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6"/><path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6"/></svg>',
  };
  const brandBar = (right) => `<div class="topbar"><span class="brand"><i class="brand-dot"></i><span>open<b>MACROS</b></span></span>${right || ''}</div>`;

  // ---------- state ----------
  function fresh() {
    return {
      v: 1,
      settings: { unit: 'lb', waterUnit: 'oz', showRemaining: true, waterGoalOz: 96 },
      profile: { sex: 'male', age: 30, heightIn: 70, startWeightLb: 180, bfPct: '', activity: 'moderate' },
      goal: null,     // { mode, targetWeightLb, ratePctWk, targetDate, protTier, split, startedAt }
      plan: null,     // { kcal, p, c, f, fiber, tdee, dailyDelta, rateLbWk, weeksToGoal, etaDate, updatedAt }
      lastCheckIn: null,
      foods: C.seedFoods(),
      recipes: [],    // [{ id, name, servings, items:[{foodId, grams}] }]
      logs: {},       // { 'YYYY-MM-DD': [{ id, meal, foodId, grams, quick, name, kcal, p, c, f, fiber }] }
      water: {},      // { 'YYYY-MM-DD': oz }
      weights: [],    // [{ id, date, weightLb, bf, waist, neck, chest, arms, hips, note }]
      lastBackup: null,
    };
  }
  function load() {
    try {
      const j = JSON.parse(localStorage.getItem(KEY));
      if (j && j.v) return Object.assign(fresh(), j);
    } catch (e) { }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save — storage full'); } }

  let FOOD = {};
  function reindex() { FOOD = Object.fromEntries(S.foods.map(f => [f.id, f])); }
  reindex();

  const ui = {
    tab: 'log',
    date: C.dateKey(),
    microsOpen: false,
    wiz: null,
    modal: null,
    foodCat: '',
    foodQ: '',
    tipHidden: false,
  };

  function toast(t) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
  }
  const uW = () => S.settings.unit === 'kg' ? 'kg' : 'lb';
  const uL = () => S.settings.unit === 'kg' ? 'cm' : 'in';
  const dispW = (lb) => lb == null || lb === '' ? '–' : r1(C.fromLb(lb, S.settings.unit));
  const dstr = (dk) => new Date(C.parseDateKey(dk)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const dayLabel = (dk) => {
    const td = C.dateKey();
    if (dk === td) return 'Today · ' + dstr(dk);
    if (dk === C.addDays(td, -1)) return 'Yesterday · ' + dstr(dk);
    if (dk === C.addDays(td, 1)) return 'Tomorrow · ' + dstr(dk);
    return new Date(C.parseDateKey(dk)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  function shareOrDownload(name, text, mime) {
    const file = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => { });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    }
    S.lastBackup = Date.now(); save();
  }

  // ---------- charts ----------
  let chartSeq = 0;
  function lineChart(series, o) {
    o = o || {}; const W = 340, H = 186, L = 40, R = 16, T = 10, B = 24;
    const pts = series.flatMap(s => s.pts);
    if (!pts.length) return '<div class="mut sm" style="padding:24px 0;text-align:center">Log entries to see trend</div>';
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    if (x1 === x0) { x0 -= 0.5; x1 += 0.5; }
    const pad = Math.max((y1 - y0) * 0.16, y1 * 0.008 || 1); y0 -= pad; y1 += pad;
    const X = (x) => L + (x - x0) / (x1 - x0) * (W - L - R), Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    const gid = 'om_g_' + (++chartSeq);
    let defs = '', g = '';
    for (let i = 0; i <= 4; i++) {
      const v = y0 + (y1 - y0) * i / 4, y = Y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#262531" stroke-width="1" ${i ? 'stroke-dasharray="3 3"' : ''}/><text x="${L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${(o.yFmt || (v => r1(v)))(v)}</text>`;
    }
    const xs = [...new Set(pts.map(p => p.x))].sort((a, b) => a - b); const step = Math.max(1, Math.ceil(xs.length / 5));
    xs.forEach((x, i) => { if (i % step === 0 || i === xs.length - 1) { const anc = i === xs.length - 1 ? "end" : (i === 0 ? "start" : "middle"); g += `<text x="${X(x).toFixed(1)}" y="${H - 6}" text-anchor="${anc}">${o.xLab ? o.xLab(x) : x}</text>`; } });
    series.forEach(s => {
      if (!s.pts.length) return;
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
      if (s.area && s.pts.length > 1) {
        defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity=".26"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
        const first = s.pts[0], last = s.pts[s.pts.length - 1], baseY = (H - B).toFixed(1);
        g += `<path d="${d} L${X(last.x).toFixed(1)} ${baseY} L${X(first.x).toFixed(1)} ${baseY} Z" fill="url(#${gid})"/>`;
      }
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.2}" ${s.dash ? 'stroke-dasharray="4 3"' : ''} stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity || 1}"/>`;
      if (s.dots !== false) {
        g += s.pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${s.dotR || 2.8}" fill="${s.color}" stroke="#18181d" stroke-width="1.3"/>`).join('');
      }
    });
    const leg = series.length > 1 ? `<div class="chips" style="margin-top:8px">${series.map(s => `<span class="chip"><i style="display:inline-block;width:7px;height:7px;border-radius:99px;background:${s.color};margin-right:5px"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${defs}${g}</svg>${leg}`;
  }

  function barChart(items, target) {
    if (!items.length) return '<div class="mut sm" style="padding:20px 0;text-align:center">No intake logged yet</div>';
    const W = 340, H = 156, L = 38, R = 8, T = 10, B = 24;
    const maxV = Math.max(target || 0, ...items.map(i => i.val), 500) * 1.12;
    const Y = (v) => T + (1 - v / maxV) * (H - T - B);
    const bw = Math.max(8, Math.min(20, (W - L - R) / items.length - 4));
    const step = (W - L - R) / items.length;
    let g = '';
    for (let i = 0; i <= 3; i++) {
      const v = maxV * i / 3, y = Y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#262531" stroke-width="1" ${i ? 'stroke-dasharray="3 3"' : ''}/><text x="${L - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end">${r0(v)}</text>`;
    }
    items.forEach((it, i) => {
      const x = L + i * step + (step - bw) / 2, y = Y(it.val), h = Math.max(0, (H - B) - y);
      const col = target && Math.abs(it.val - target) <= target * 0.08 ? '#6bbf9b' : (target && it.val > target * 1.12 ? '#d9b464' : '#8b74bd');
      g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${col}" opacity="${it.val > 0 ? '.9' : '.2'}"/>`;
      if (i % Math.max(1, Math.ceil(items.length / 5)) === 0 || i === items.length - 1) {
        g += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(it.label)}</text>`;
      }
    });
    if (target > 0) {
      const ty = Y(target).toFixed(1);
      g += `<line x1="${L}" x2="${W - R}" y1="${ty}" y2="${ty}" stroke="#b7a5e0" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>`;
  }

  // ---------- views ----------
  function viewLog() {
    const dk = ui.date;
    const entries = S.logs[dk] || [];
    const tot = C.dayTotals(entries, FOOD);
    const plan = S.plan;
    const remMode = S.settings.showRemaining && !!plan;
    const checkDue = S.goal && S.plan && (!S.lastCheckIn || Date.now() - S.lastCheckIn >= 7 * 86400000);

    let h = brandBar(plan ? `<button class="sm ghost" onclick="A.toggleRem()">${remMode ? 'Remaining' : 'Consumed'}</button>` : '');
    h += `<div class="row" style="margin-bottom:12px"><button class="ico" onclick="A.shiftDay(-1)">‹</button><div class="sp" style="text-align:center"><b style="font-size:16px">${esc(dayLabel(dk))}</b></div><button class="ico" onclick="A.shiftDay(1)">›</button></div>`;

    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    if (!standalone && /iPhone|iPad/.test(navigator.userAgent) && !ui.tipHidden) {
      h += `<div class="card notice sm row"><div class="sp"><b>Install openMACROS:</b> tap Share → <b>Add to Home Screen</b> for full-screen offline use.</div><button class="sm ghost" onclick="ui_hideTip()">✕</button></div>`;
    }
    if (checkDue) {
      h += `<div class="card notice row"><div class="sp"><b class="sm">Weekly check-in ready</b><div class="xs mut">Review adaptive expenditure &amp; update targets</div></div><button class="pri sm" onclick="A.openCheckIn()">Check in</button></div>`;
    }

    // Hero Macro & Calorie Card
    if (plan) {
      const kcalDisp = remMode ? r0(plan.kcal - tot.kcal) : r0(tot.kcal);
      const kcalPct = C.clamp((tot.kcal / Math.max(1, plan.kcal)) * 100, 0, 100);
      const over = tot.kcal > plan.kcal * 1.04;
      h += `<div class="card hero">
        <div class="row" style="align-items:flex-end">
          <div class="sp">
            <div class="xs mut" style="text-transform:uppercase;letter-spacing:.08em">${remMode ? 'Calories remaining' : 'Calories consumed'}</div>
            <div class="num" style="font-size:32px;font-weight:700;line-height:1.1;margin-top:3px;color:${over ? 'var(--warn)' : 'var(--tx)'}">${kcalDisp} <span class="sm mut" style="font-weight:500">/ ${plan.kcal} kcal</span></div>
          </div>
          <span class="chip sel num">${r0(tot.kcal)} in</span>
        </div>
        <div class="prog" style="margin:12px 0 14px"><i style="width:${kcalPct}%;${over ? 'background:var(--warn)' : ''}"></i></div>
        <div class="g3">
          ${macroBox('Protein', tot.p, plan.p, 'var(--p-col)', remMode)}
          ${macroBox('Carbs', tot.c, plan.c, 'var(--c-col)', remMode)}
          ${macroBox('Fat', tot.f, plan.f, 'var(--f-col)', remMode)}
        </div>
      </div>`;
    } else {
      h += `<div class="card hero"><div class="row"><div class="sp"><b style="font-size:17px">Set your nutrition goal</b><div class="sm mut" style="margin-top:3px">Get an adaptive calorie &amp; macro plan based on your body stats, goal, and timeline.</div></div><button class="pri sm" onclick="A.startWiz()">Set goal</button></div>
        <div class="g4" style="margin-top:12px">
          <div class="kpi"><div class="k-lbl">Kcal</div><div class="k-val">${r0(tot.kcal)}</div></div>
          <div class="kpi"><div class="k-lbl">Prot</div><div class="k-val">${r0(tot.p)}g</div></div>
          <div class="kpi"><div class="k-lbl">Carb</div><div class="k-val">${r0(tot.c)}g</div></div>
          <div class="kpi"><div class="k-lbl">Fat</div><div class="k-val">${r0(tot.f)}g</div></div>
        </div></div>`;
    }

    // Micronutrients & Water collapsible card (Cronometer-inspired)
    const wOz = S.water[dk] || 0;
    const isMl = S.settings.waterUnit === 'ml';
    const wDisp = isMl ? Math.round(wOz * 29.5735) : r0(wOz);
    const wGoal = isMl ? Math.round(S.settings.waterGoalOz * 29.5735) : S.settings.waterGoalOz;
    const fibTarget = (plan && plan.fiber) || C.MICRO_TARGETS.fiber.target;
    h += `<div class="card" style="padding:12px 15px">
      <div class="row" style="cursor:pointer" onclick="ui_toggleMicros()">
        <div class="sp"><b class="sm">Micronutrients &amp; Water</b><div class="xs mut num" style="margin-top:2px">Fiber ${r0(tot.fiber)}/${fibTarget}g · Water ${wDisp}/${wGoal} ${S.settings.waterUnit}</div></div>
        <button class="sm" onclick="event.stopPropagation();A.addWater(8)">+${isMl ? '250ml' : '8oz'}</button>
        <span class="chev">${ui.microsOpen ? '▾' : '▸'}</span>
      </div>`;
    if (ui.microsOpen) {
      h += `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">`;
      Object.entries(C.MICRO_TARGETS).forEach(([k, meta]) => {
        const tgt = k === 'fiber' ? fibTarget : meta.target;
        const val = tot[k] || 0;
        const pct = C.clamp((val / tgt) * 100, 0, 100);
        const col = meta.cap ? (val > tgt ? 'var(--warn)' : 'var(--acc)') : (val >= tgt ? 'var(--ok)' : 'var(--acc)');
        h += `<div class="row" style="padding:5px 0"><span class="xs" style="width:76px;color:var(--tx2)">${meta.label}</span><div class="bar sp"><i style="width:${pct}%;background:${col}"></i></div><span class="xs num mut" style="width:94px;text-align:right">${k === 'fe' || k === 'vitd' ? r1(val) : r0(val)} / ${tgt}${meta.unit}</span></div>`;
      });
      h += `<div class="row" style="margin-top:8px"><button class="sm ghost" onclick="A.addWater(-8)">−${isMl ? '250ml' : '8oz'} water</button><span class="sp"></span><button class="sm ghost" onclick="A.copyYesterday()">Copy yesterday's log</button></div></div>`;
    }
    h += '</div>';

    // Meals
    C.MEALS.forEach(meal => {
      const mItems = entries.filter(e => e.meal === meal);
      const mt = C.dayTotals(mItems, FOOD);
      h += `<div class="card">
        <div class="row" style="margin-bottom:${mItems.length ? '8px' : '0'}">
          <div class="sp"><b style="font-size:15px">${meal}</b>${mItems.length ? `<div class="xs mut num" style="margin-top:2px">${r0(mt.kcal)} kcal · P ${r0(mt.p)} · C ${r0(mt.c)} · F ${r0(mt.f)}</div>` : ''}</div>
          <button class="sm" onclick="A.openAdd('${meal}')">+ Add</button>
        </div>`;
      mItems.forEach(e => {
        const food = e.quick ? null : FOOD[e.foodId];
        const n = e.quick ? e : C.foodNutrients(food, e.grams);
        const title = e.quick ? (e.name || 'Quick Add') : (food ? food.name : '?');
        const sub = e.quick ? 'Quick entry' : `${r0(e.grams)}g · P ${r0(n.p)} · C ${r0(n.c)} · F ${r0(n.f)}`;
        h += `<div class="li" onclick="A.editEntry('${e.id}')"><div class="sp"><div class="sm" style="color:var(--tx)">${esc(title)}</div><div class="xs mut num">${esc(sub)}</div></div><b class="sm num">${r0(n.kcal)}</b></div>`;
      });
      h += '</div>';
    });

    if (!entries.length) {
      const yEntries = S.logs[C.addDays(dk, -1)] || [];
      if (yEntries.length) h += `<button class="ghost" style="width:100%" onclick="A.copyYesterday()">Copy yesterday's meals (${yEntries.length} items)</button>`;
    }
    return h;
  }

  function macroBox(label, val, target, color, remMode) {
    const shown = remMode ? r0(target - val) : r0(val);
    const pct = C.clamp((val / Math.max(1, target)) * 100, 0, 100);
    return `<div class="macro-box"><div class="m-head"><span class="mut">${label}</span><span class="dim num">${target}g</span></div><div class="m-val" style="color:${shown < 0 ? 'var(--warn)' : 'var(--tx)'}">${shown}g</div><div class="bar" style="margin-top:6px"><i style="width:${pct}%;background:${color}"></i></div></div>`;
  }

  // ---------- Plan & Coaching Tab ----------
  function viewPlan() {
    if (ui.wiz) return viewWiz();
    const g = S.goal, p = S.plan;
    const exp = C.estimateExpenditure(S.profile, S.weights, S.logs, FOOD);
    let h = brandBar() + '<h1>Plan &amp; Coach</h1>';

    if (!g || !p) {
      h += `<div class="card hero"><b style="font-size:17px">No active nutrition plan</b><p class="sm" style="margin-top:6px">Configure your body metrics, goal (cut, maintain, or lean bulk), target timeline, and macro preference. openMACROS will adapt your calories as your weigh-ins and food logs come in.</p><button class="pri" style="width:100%" onclick="A.startWiz()">Create nutrition plan</button></div>`;
    } else {
      const modeName = { lose: 'Fat Loss (Cut)', maintain: 'Dynamic Maintenance', gain: 'Muscle Gain (Bulk)' }[g.mode] || g.mode;
      const confPct = Math.round(exp.confidence * 100);
      h += `<div class="card hero">
        <div class="row"><div class="sp"><div class="xs mut" style="text-transform:uppercase;letter-spacing:.08em">Active goal</div><b style="font-size:17px">${modeName}</b></div><span class="chip sel num">${p.kcal} kcal</span></div>
        <div class="g3" style="margin:12px 0">
          <div class="kpi"><div class="k-lbl">Protein</div><div class="k-val" style="color:var(--p-col)">${p.p}g</div></div>
          <div class="kpi"><div class="k-lbl">Carbs</div><div class="k-val" style="color:var(--c-col)">${p.c}g</div></div>
          <div class="kpi"><div class="k-lbl">Fat</div><div class="k-val" style="color:var(--f-col)">${p.f}g</div></div>
        </div>
        <div class="row xs mut num" style="margin-bottom:4px"><span class="sp">Estimated expenditure: <b style="color:var(--tx)">${exp.tdee} kcal/d</b></span><span>Adaptive ${confPct}%</span></div>
        <div class="row xs mut num" style="margin-bottom:12px"><span class="sp">Target: ${g.targetWeightLb ? dispW(g.targetWeightLb) + ' ' + uW() : 'Hold current'} (${p.rateLbWk >= 0 ? '+' : ''}${dispW(p.rateLbWk)} ${uW()}/wk)</span><span>${p.etaDate ? 'ETA ' + dstr(p.etaDate) : (g.targetDate ? 'By ' + dstr(g.targetDate) : 'Ongoing')}</span></div>
        <div class="g2"><button class="pri" onclick="A.openCheckIn()">Weekly check-in</button><button onclick="A.startWiz(true)">Edit goal</button></div>
      </div>`;
    }

    // Saved Meals / Recipes (Cronometer-style)
    h += `<h2>Saved Meals &amp; Recipes</h2><div class="card">`;
    if (!S.recipes.length) {
      h += `<div class="mut sm" style="margin-bottom:10px">Save frequently eaten meals or recipes to log multi-ingredient dishes in one tap.</div>`;
    } else {
      S.recipes.forEach(rc => {
        const t = C.recipeTotals(rc, FOOD).perServing;
        h += `<div class="li" onclick="A.openRecipe('${rc.id}')"><div class="sp"><b class="sm">${esc(rc.name)}</b><div class="xs mut num">${rc.items.length} items · ${rc.servings} srv · ${r0(t.kcal)} kcal/srv (P ${r0(t.p)} · C ${r0(t.c)} · F ${r0(t.f)})</div></div><button class="sm" onclick="event.stopPropagation();A.quickLogRecipe('${rc.id}')">+ Log</button></div>`;
      });
    }
    h += `<button class="sm" style="margin-top:${S.recipes.length ? '10px' : '0'}" onclick="A.openRecipe(null)">+ New meal / recipe</button></div>`;
    return h;
  }

  // ---------- Guided Goal Wizard ----------
  function viewWiz() {
    const w = ui.wiz;
    const head = (title, step, back) => brandBar() + `<div class="row" style="margin:2px 0 4px"><button class="sm ghost" style="padding-left:4px" onclick="A.wizBack('${back}')">‹ Back</button><span class="sp"></span><span class="mut xs">${step}</span></div><h1>${title}</h1>`;

    if (w.step === 'mode') {
      return head('What is your goal?', 'Step 1 of 3', 'cancel')
        + `<div class="card tap ${w.mode === 'lose' ? 'hero' : ''}" onclick="A.wizSet('mode','lose','body')"><div class="row"><div class="sp"><b>Fat Loss (Cut)</b><div class="sm mut" style="margin-top:3px">Controlled calorie deficit with high protein to preserve lean mass.</div></div><span class="chev">›</span></div></div>`
        + `<div class="card tap ${w.mode === 'maintain' ? 'hero' : ''}" onclick="A.wizSet('mode','maintain','body')"><div class="row"><div class="sp"><b>Dynamic Maintenance</b><div class="sm mut" style="margin-top:3px">Hold your target weight while expenditure adapts automatically.</div></div><span class="chev">›</span></div></div>`
        + `<div class="card tap ${w.mode === 'gain' ? 'hero' : ''}" onclick="A.wizSet('mode','gain','body')"><div class="row"><div class="sp"><b>Muscle Gain (Lean Bulk)</b><div class="sm mut" style="margin-top:3px">Modest surplus calibrated to limit excess fat gain.</div></div><span class="chev">›</span></div></div>`;
    }

    if (w.step === 'body') {
      const dispCurW = r1(C.fromLb(w.startWeightLb, S.settings.unit));
      const dispTgtW = r1(C.fromLb(w.targetWeightLb, S.settings.unit));
      const dispH = S.settings.unit === 'kg' ? r0(w.heightIn * C.CM_PER_IN) : r1(w.heightIn);
      return head('Body stats & timeline', 'Step 2 of 3', 'mode')
        + `<div class="card">
          <div class="g2" style="margin-bottom:10px">
            <label class="xs mut">Sex<select onchange="A.wizF('sex',this.value)"><option value="male" ${w.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${w.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
            <label class="xs mut">Age<input type="number" inputmode="numeric" value="${w.age}" oninput="A.wizF('age',+this.value)"></label>
          </div>
          <div class="g3" style="margin-bottom:10px">
            <label class="xs mut">Height (${uL()})<input type="number" step="any" value="${dispH}" oninput="A.wizHeight(this.value)"></label>
            <label class="xs mut">Weight (${uW()})<input type="number" step="any" value="${dispCurW}" oninput="A.wizWeight('startWeightLb',this.value)"></label>
            <label class="xs mut">Body fat %<input type="number" step="any" placeholder="opt" value="${w.bfPct}" oninput="A.wizF('bfPct',this.value===''?'':+this.value)"></label>
          </div>
          <label class="xs mut">Activity level<select onchange="A.wizF('activity',this.value)">${C.ACTIVITY.map(a => `<option value="${a.k}" ${w.activity === a.k ? 'selected' : ''}>${a.label} — ${a.desc}</option>`).join('')}</select></label>
        </div>
        <div class="card">
          <div class="g2" style="margin-bottom:10px">
            <label class="xs mut">Target weight (${uW()})<input type="number" step="any" value="${dispTgtW}" oninput="A.wizWeight('targetWeightLb',this.value)"></label>
            <label class="xs mut">Target date (optional)<input type="date" value="${w.targetDate || ''}" onchange="A.wizDate(this.value)"></label>
          </div>
          ${w.mode !== 'maintain' ? `<label class="xs mut">Weekly pace: <b style="color:var(--acc-hi)">${w.ratePctWk}% BW/wk</b> (${r1(C.fromLb(w.startWeightLb * w.ratePctWk / 100, S.settings.unit))} ${uW()}/wk)
            <input type="range" min="0.2" max="1.25" step="0.05" value="${w.ratePctWk}" style="padding:0;min-height:30px;accent-color:var(--acc)" oninput="A.wizRate(+this.value)">
          </label>` : '<div class="xs mut">Dynamic Maintenance keeps you within ±1.5% of your target weight.</div>'}
        </div>
        <button class="pri" style="width:100%" onclick="A.wizGo('macros')">Next: macro targets ›</button>`;
    }

    if (w.step === 'macros') {
      const tdee = C.initialTDEE(w, w.startWeightLb, w.bfPct);
      const prev = C.buildPlan(w, w, tdee, w.startWeightLb, w.bfPct);
      return head('Macros & preview', 'Step 3 of 3', 'body')
        + `<div class="card">
          <label class="xs mut" style="margin-bottom:10px">Protein intake<select onchange="A.wizF('protTier',this.value);A.reRender()">${Object.entries(C.PROT_TIERS).map(([k, v]) => `<option value="${k}" ${w.protTier === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
          <label class="xs mut">Carb / fat preference<select onchange="A.wizF('split',this.value);A.reRender()">${Object.entries(C.SPLITS).map(([k, v]) => `<option value="${k}" ${w.split === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        </div>
        <div class="card hero">
          <div class="row"><b class="sp">Initial daily plan</b><span class="chip sel num">TDEE ~${prev.tdee}</span></div>
          <div class="num" style="font-size:28px;font-weight:700;margin:8px 0 12px">${prev.kcal} <span class="sm mut">kcal / day</span></div>
          <div class="g3">
            <div class="kpi"><div class="k-lbl">Protein</div><div class="k-val" style="color:var(--p-col)">${prev.p}g</div></div>
            <div class="kpi"><div class="k-lbl">Carbs</div><div class="k-val" style="color:var(--c-col)">${prev.c}g</div></div>
            <div class="kpi"><div class="k-lbl">Fat</div><div class="k-val" style="color:var(--f-col)">${prev.f}g</div></div>
          </div>
          <div class="xs mut num" style="margin-top:10px">Fiber target: ${prev.fiber}g/day${prev.etaDate ? ' · Projected ETA: ' + dstr(prev.etaDate) + ' (' + prev.weeksToGoal + ' wks)' : ''}</div>
        </div>
        <button class="pri" style="width:100%" onclick="A.saveWiz()">Start plan</button>`;
    }
    return '';
  }

  // ---------- Body Comp & Analytics Tab ----------
  function viewBody() {
    const tr = C.trendWeights(S.weights);
    const exp = C.estimateExpenditure(S.profile, S.weights, S.logs, FOOD);
    const sortedW = S.weights.slice().sort((a, b) => b.date.localeCompare(a.date));
    const latest = sortedW[0] || null;
    const latestTrend = tr.length ? tr[tr.length - 1].trend : null;
    const prev7Trend = tr.length > 7 ? tr[tr.length - 8].trend : null;
    const delta7 = (latestTrend != null && prev7Trend != null) ? r1(C.fromLb(latestTrend - prev7Trend, S.settings.unit)) : null;
    const latestBf = sortedW.find(w => w.bf > 0)?.bf || S.profile.bfPct || null;
    const comp = C.bodyComp(latestTrend ? C.fromLb(latestTrend, S.settings.unit) : null, latestBf);

    let h = brandBar(`<button class="pri sm" onclick="A.openWeigh()">+ Weigh-in</button>`) + '<h1>Body &amp; Trends</h1>';

    // KPI Grid
    h += `<div class="g2" style="margin-bottom:10px">
      <div class="kpi"><div class="k-lbl">Trend Weight</div><div class="k-val">${latestTrend ? dispW(latestTrend) + ' ' + uW() : '–'}</div><div class="k-sub">${delta7 != null ? (delta7 >= 0 ? '+' : '') + delta7 + ' ' + uW() + ' (7d)' : 'Log weigh-ins'}</div></div>
      <div class="kpi"><div class="k-lbl">Scale Weight</div><div class="k-val">${latest ? dispW(latest.weightLb) + ' ' + uW() : '–'}</div><div class="k-sub">${latest ? dstr(latest.date) : 'No entries yet'}</div></div>
      <div class="kpi"><div class="k-lbl">Body Fat / LBM</div><div class="k-val">${latestBf ? latestBf + '%' : '–'}</div><div class="k-sub">${comp.lbm ? 'Lean: ' + comp.lbm + ' ' + uW() : 'Add BF% or tape'}</div></div>
      <div class="kpi"><div class="k-lbl">Expenditure</div><div class="k-val">${exp.tdee} kcal</div><div class="k-sub">Adaptive ${Math.round(exp.confidence * 100)}%</div></div>
    </div>`;

    // Chart 1: Scale vs Trend Weight (last 35 days)
    const sliceTr = tr.slice(-35);
    const scalePts = sliceTr.map((d, i) => d.scale != null ? { x: i, y: C.fromLb(d.scale, S.settings.unit) } : null).filter(Boolean);
    const trendPts = sliceTr.map((d, i) => ({ x: i, y: C.fromLb(d.trend, S.settings.unit) }));
    h += `<h2>Weight trend <span class="xs dim" style="text-transform:none;letter-spacing:0">(scale vs. smoothed trend)</span></h2><div class="card">`
      + lineChart([
        { name: 'Scale', color: '#626070', width: 1.5, dash: true, opacity: 0.75, dotR: 2.3, pts: scalePts },
        { name: 'Trend', color: '#b7a5e0', width: 2.4, dots: false, pts: trendPts },
      ], { xLab: i => sliceTr[i] ? dstr(sliceTr[i].date) : '', yFmt: v => r1(v) }) + '</div>';

    // Chart 2: Adaptive Expenditure
    const sliceExp = exp.series.slice(-30);
    h += `<h2>Adaptive expenditure <span class="xs dim" style="text-transform:none;letter-spacing:0">(estimated kcal/day)</span></h2><div class="card">`
      + lineChart([{ name: 'TDEE', color: '#9d86d1', area: true, dots: false, pts: sliceExp.map((d, i) => ({ x: i, y: d.tdee })) }], { xLab: i => sliceExp[i] ? dstr(sliceExp[i].date) : '', yFmt: v => r0(v) }) + '</div>';

    // Chart 3: 14-day Calorie Adherence
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const dk = C.addDays(C.dateKey(), -i);
      const t = C.dayTotals(S.logs[dk], FOOD);
      bars.push({ label: dstr(dk).replace(' ', '\u00a0'), val: r0(t.kcal) });
    }
    h += `<h2>14-day intake vs. target</h2><div class="card">` + barChart(bars, S.plan ? S.plan.kcal : 0) + '</div>';

    // Recent Weigh-ins & Measurements
    h += `<h2>Measurements history</h2><div class="card" style="padding:4px 15px">`;
    if (!sortedW.length) h += `<div class="mut sm" style="padding:12px 0">No weigh-ins logged yet.</div>`;
    else {
      sortedW.slice(0, 12).forEach(w => {
        const extras = [w.bf ? w.bf + '% BF' : '', w.waist ? 'Waist ' + w.waist + uL() : '', w.chest ? 'Chest ' + w.chest + uL() : '', w.arms ? 'Arms ' + w.arms + uL() : ''].filter(Boolean).join(' · ');
        h += `<div class="li" onclick="A.openWeigh('${w.id}')"><div class="sp"><b class="sm num">${dispW(w.weightLb)} ${uW()}</b><div class="xs mut">${dstr(w.date)}${extras ? ' · ' + esc(extras) : ''}</div></div><button class="sm ghost bad" onclick="event.stopPropagation();A.delWeigh('${w.id}')">✕</button></div>`;
      });
    }
    h += '</div>';
    return h;
  }

  // ---------- Data Tab ----------
  function viewData() {
    const daysLogged = Object.keys(S.logs).filter(k => (S.logs[k] || []).length).length;
    let h = brandBar() + '<h1>Data</h1>';
    h += `<div class="card hero"><b>Export &amp; backup</b><div class="mut xs num" style="margin:4px 0 12px">${daysLogged} day${daysLogged === 1 ? '' : 's'} logged · ${S.weights.length} weigh-in${S.weights.length === 1 ? '' : 's'}${S.lastBackup ? ' · Last backup ' + dstr(C.dateKey(S.lastBackup)) : ''}</div>
      <div class="g2" style="margin-bottom:8px"><button class="pri" onclick="A.expDiaryCSV()">Diary CSV</button><button onclick="A.expBioCSV()">Biometrics CSV</button></div>
      <div class="g2"><button onclick="A.expJSON()">Backup JSON</button><label class="btn">Restore JSON<input type="file" accept=".json,application/json" style="display:none" onchange="A.restore(this)"></label></div>
      <div class="xs mut" style="margin-top:9px">Everything stays local on your device. Export JSON before removing the home-screen app.</div></div>`;

    h += `<h2>Settings</h2><div class="card">
      <div class="g2" style="margin-bottom:10px">
        <label class="xs mut">Weight / length units<select onchange="A.setting('unit',this.value)"><option value="lb" ${S.settings.unit === 'lb' ? 'selected' : ''}>lb / in</option><option value="kg" ${S.settings.unit === 'kg' ? 'selected' : ''}>kg / cm</option></select></label>
        <label class="xs mut">Water unit<select onchange="A.setting('waterUnit',this.value)"><option value="oz" ${S.settings.waterUnit === 'oz' ? 'selected' : ''}>oz</option><option value="ml" ${S.settings.waterUnit === 'ml' ? 'selected' : ''}>ml</option></select></label>
      </div>
      <label class="xs mut">Daily water goal (${S.settings.waterUnit})<input type="number" inputmode="numeric" value="${S.settings.waterUnit === 'ml' ? Math.round(S.settings.waterGoalOz * 29.5735) : S.settings.waterGoalOz}" onchange="A.setWaterGoal(this.value)"></label>
    </div>`;

    // Food Library
    const flist = S.foods.filter(f => (!ui.foodCat || f.cat === ui.foodCat) && (!ui.foodQ || f.name.toLowerCase().includes(ui.foodQ.toLowerCase())));
    h += `<h2>Food library (${S.foods.length})</h2><div class="card">
      <div class="row" style="margin-bottom:10px"><input placeholder="Filter foods…" value="${esc(ui.foodQ)}" oninput="ui_foodQ(this.value)"><button class="sm pri" onclick="A.openFoodEdit(null)">+ Food</button></div>
      <div class="chips" style="margin-bottom:10px">${['', ...C.CATS].map(c => `<button class="chip ${ui.foodCat === c ? 'sel' : ''}" onclick="ui_foodCat('${c}')">${c || 'All'}</button>`).join('')}</div>
      <div style="max-height:320px;overflow:auto">${flist.slice(0, 60).map(f => `<div class="li" onclick="A.openFoodEdit('${f.id}')"><div class="sp"><div class="sm">${esc(f.name)}</div><div class="xs mut num">${f.kcal} kcal / 100g · P ${f.p} · C ${f.c} · F ${f.f}</div></div><span class="chip">${esc(f.cat)}</span></div>`).join('') || '<div class="mut sm" style="padding:10px 0">No matching foods.</div>'}</div>
    </div>`;

    h += `<div style="height:8px"></div><button class="bad ghost" style="width:100%" onclick="A.reset()">Erase all data</button>
      <div class="xs dim num" style="text-align:center;margin:16px 0 6px">openMACROS · build ${BUILD}</div>`;
    return h;
  }

  // ---------- Modals ----------
  function modalHTML() {
    const m = ui.modal;
    if (m.type === 'add') {
      const sub = m.sub || 'foods';
      let body = `<div class="row" style="margin-bottom:10px"><b class="sp" style="font-size:17px">Add to ${esc(m.meal)}</b><button class="sm ghost" onclick="A.closeModal()">Close</button></div>
        <div class="seg"><button class="${sub === 'foods' ? 'on' : ''}" onclick="A.addSub('foods')">Foods</button><button class="${sub === 'meals' ? 'on' : ''}" onclick="A.addSub('meals')">Saved Meals</button><button class="${sub === 'quick' ? 'on' : ''}" onclick="A.addSub('quick')">Quick Add</button></div>`;
      if (sub === 'foods') {
        if (m.picked) {
          const f = FOOD[m.picked];
          const grams = m.unitMode === 'srv' ? (m.qty * f.srvG) : m.qty;
          const n = C.foodNutrients(f, grams);
          body += `<div class="card hero"><div class="row"><b class="sp">${esc(f.name)}</b><button class="sm ghost" onclick="A.unpickFood()">Change</button></div>
            <div class="g2" style="margin:10px 0"><label class="xs mut">Amount<input id="a_qty" type="number" step="any" inputmode="decimal" value="${m.qty}" oninput="A.setQty(this.value)"></label>
            <label class="xs mut">Unit<select onchange="A.setUnitMode(this.value)"><option value="srv" ${m.unitMode === 'srv' ? 'selected' : ''}>${esc(f.srvLabel)} (${f.srvG}g)</option><option value="g" ${m.unitMode === 'g' ? 'selected' : ''}>Grams (g)</option></select></label></div>
            <div id="a_prev" class="g4">
              <div class="kpi"><div class="k-lbl">Kcal</div><div class="k-val">${r0(n.kcal)}</div></div>
              <div class="kpi"><div class="k-lbl">Prot</div><div class="k-val" style="color:var(--p-col)">${r1(n.p)}g</div></div>
              <div class="kpi"><div class="k-lbl">Carb</div><div class="k-val" style="color:var(--c-col)">${r1(n.c)}g</div></div>
              <div class="kpi"><div class="k-lbl">Fat</div><div class="k-val" style="color:var(--f-col)">${r1(n.f)}g</div></div>
            </div>
            <button class="pri" style="width:100%;margin-top:12px" onclick="A.commitFood()">${m.editId ? 'Update entry' : 'Add to ' + esc(m.meal)}</button>
            ${m.editId ? `<button class="bad ghost" style="width:100%;margin-top:6px" onclick="A.delEntry('${m.editId}')">Delete entry</button>` : ''}</div>`;
        } else {
          body += `<div class="row" style="margin-bottom:8px"><input id="fq" placeholder="Search foods…" value="${esc(m.q || '')}" oninput="A.fq(this.value)"><button class="sm" onclick="A.openFoodEdit(null,true)">＋</button></div>
            <div class="chips" style="margin-bottom:8px">${C.CATS.map(c => `<button class="chip ${m.cat === c ? 'sel' : ''}" onclick="A.fcat('${c}')">${c}</button>`).join('')}</div>
            <div id="fl">${foodPickList()}</div>`;
        }
      } else if (sub === 'meals') {
        body += S.recipes.length ? S.recipes.map(rc => {
          const t = C.recipeTotals(rc, FOOD).perServing;
          return `<div class="li" onclick="A.logRecipe('${rc.id}','${m.meal}')"><div class="sp"><b class="sm">${esc(rc.name)}</b><div class="xs mut num">${r0(t.kcal)} kcal · P ${r0(t.p)} · C ${r0(t.c)} · F ${r0(t.f)}</div></div><span class="chip sel">+ Log</span></div>`;
        }).join('') : `<div class="mut sm" style="padding:14px 0">No saved meals yet. Create one on the Plan tab.</div>`;
      } else {
        body += `<input id="q_name" placeholder="Label (e.g. Restaurant lunch)" value="${esc(m.qName || '')}" style="margin-bottom:8px">
          <div class="g2" style="margin-bottom:8px"><label class="xs mut">Calories<input id="q_kcal" type="number" inputmode="numeric" value="${m.qKcal || ''}"></label><label class="xs mut">Protein (g)<input id="q_p" type="number" inputmode="decimal" value="${m.qP || ''}"></label></div>
          <div class="g3" style="margin-bottom:12px"><label class="xs mut">Carbs (g)<input id="q_c" type="number" inputmode="decimal" value="${m.qC || ''}"></label><label class="xs mut">Fat (g)<input id="q_f" type="number" inputmode="decimal" value="${m.qF || ''}"></label><label class="xs mut">Fiber (g)<input id="q_fib" type="number" inputmode="decimal" value="${m.qFib || ''}"></label></div>
          <button class="pri" style="width:100%" onclick="A.commitQuick()">${m.editId ? 'Update entry' : 'Add to ' + esc(m.meal)}</button>
          ${m.editId ? `<button class="bad ghost" style="width:100%;margin-top:6px" onclick="A.delEntry('${m.editId}')">Delete entry</button>` : ''}`;
      }
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet">${body}</div></div>`;
    }

    if (m.type === 'checkin') {
      const ci = C.weeklyCheckIn(S.profile, S.goal, S.weights, S.logs, FOOD, S.plan);
      const sign = ci.diffKcal > 0 ? '+' : '';
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet">
        <div class="row" style="margin-bottom:10px"><b class="sp" style="font-size:19px">Weekly Check-In</b><span class="chip sel num">TDEE ${ci.exp.tdee}</span></div>
        <p class="sm">${esc(ci.reason)}</p>
        <div class="card hero">
          <div class="row" style="margin-bottom:10px"><span class="xs mut">Proposed daily target</span><span class="sp"></span><span class="badge ${ci.diffKcal > 0 ? 'up' : ci.diffKcal < 0 ? 'dl' : 'hd'} num">${ci.diffKcal === 0 ? 'No change' : sign + ci.diffKcal + ' kcal'}</span></div>
          <div class="num" style="font-size:28px;font-weight:700;margin-bottom:10px">${ci.proposed.kcal} <span class="sm mut">kcal (was ${ci.prevKcal})</span></div>
          <div class="g3">
            <div class="kpi"><div class="k-lbl">Protein</div><div class="k-val" style="color:var(--p-col)">${ci.proposed.p}g</div></div>
            <div class="kpi"><div class="k-lbl">Carbs</div><div class="k-val" style="color:var(--c-col)">${ci.proposed.c}g</div></div>
            <div class="kpi"><div class="k-lbl">Fat</div><div class="k-val" style="color:var(--f-col)">${ci.proposed.f}g</div></div>
          </div>
        </div>
        <div class="g2"><button onclick="A.closeModal()">Keep current</button><button class="pri" onclick="A.applyCheckIn()">Apply update</button></div>
      </div></div>`;
    }

    if (m.type === 'weigh') {
      const w = m.entry;
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet">
        <b style="font-size:19px;display:block;margin-bottom:12px">${m.id ? 'Edit' : 'Log'} weigh-in &amp; body comp</b>
        <div class="g2" style="margin-bottom:10px">
          <label class="xs mut">Date<input id="w_date" type="date" value="${esc(w.date)}"></label>
          <label class="xs mut">Weight (${uW()})<input id="w_wt" type="number" step="any" inputmode="decimal" value="${w.weightDisp}"></label>
        </div>
        <div class="g3" style="margin-bottom:10px">
          <label class="xs mut">Body fat %<input id="w_bf" type="number" step="any" inputmode="decimal" placeholder="opt" value="${w.bf}"></label>
          <label class="xs mut">Waist (${uL()})<input id="w_waist" type="number" step="any" inputmode="decimal" value="${w.waist}"></label>
          <label class="xs mut">Neck (${uL()})<input id="w_neck" type="number" step="any" inputmode="decimal" value="${w.neck}"></label>
        </div>
        <div class="g3" style="margin-bottom:10px">
          <label class="xs mut">Chest (${uL()})<input id="w_chest" type="number" step="any" inputmode="decimal" value="${w.chest}"></label>
          <label class="xs mut">Arms (${uL()})<input id="w_arms" type="number" step="any" inputmode="decimal" value="${w.arms}"></label>
          <label class="xs mut">Hips (${uL()})<input id="w_hips" type="number" step="any" inputmode="decimal" value="${w.hips}"></label>
        </div>
        <button class="sm" style="width:100%;margin-bottom:10px" onclick="A.calcNavy()">Estimate BF% from waist &amp; neck (US Navy)</button>
        <input id="w_note" placeholder="Optional note…" value="${esc(w.note || '')}" style="margin-bottom:12px">
        <div class="g2"><button onclick="A.closeModal()">Cancel</button><button class="pri" onclick="A.saveWeigh()">Save</button></div>
      </div></div>`;
    }

    if (m.type === 'foodEdit') {
      const f = m.food;
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet">
        <b style="font-size:19px;display:block;margin-bottom:10px">${m.id ? 'Edit' : 'New'} food (per 100g)</b>
        <input id="fe_name" placeholder="Food name" value="${esc(f.name)}" style="margin-bottom:8px">
        <div class="g3" style="margin-bottom:8px">
          <label class="xs mut">Category<select id="fe_cat">${C.CATS.map(c => `<option ${c === f.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="xs mut">Serving label<input id="fe_sl" value="${esc(f.srvLabel)}"></label>
          <label class="xs mut">Serving (g)<input id="fe_sg" type="number" step="any" value="${f.srvG}"></label>
        </div>
        <div class="g4" style="margin-bottom:8px">
          <label class="xs mut">Kcal<input id="fe_kcal" type="number" step="any" value="${f.kcal}"></label>
          <label class="xs mut">Prot<input id="fe_p" type="number" step="any" value="${f.p}"></label>
          <label class="xs mut">Carb<input id="fe_c" type="number" step="any" value="${f.c}"></label>
          <label class="xs mut">Fat<input id="fe_f" type="number" step="any" value="${f.f}"></label>
        </div>
        <div class="g3" style="margin-bottom:12px">
          <label class="xs mut">Fiber (g)<input id="fe_fib" type="number" step="any" value="${f.fiber}"></label>
          <label class="xs mut">Sodium (mg)<input id="fe_na" type="number" step="any" value="${f.na}"></label>
          <label class="xs mut">Potassium (mg)<input id="fe_k" type="number" step="any" value="${f.k}"></label>
        </div>
        <div class="g2">${m.id ? '<button class="bad" onclick="A.delFood()">Delete</button>' : '<button onclick="A.closeModal()">Cancel</button>'}<button class="pri" onclick="A.saveFood()">Save</button></div>
      </div></div>`;
    }

    if (m.type === 'recipe') {
      const rc = m.rc, tot = C.recipeTotals(rc, FOOD).perServing;
      return `<div class="modal" onclick="if(event.target===this)A.closeModal()"><div class="sheet">
        <b style="font-size:19px;display:block;margin-bottom:10px">${m.id ? 'Edit' : 'New'} saved meal</b>
        <div class="g2" style="margin-bottom:10px">
          <label class="xs mut">Meal name<input value="${esc(rc.name)}" placeholder="e.g. Post-Workout Bowl" oninput="A.rcField('name',this.value)"></label>
          <label class="xs mut">Servings<input type="number" min="1" value="${rc.servings}" oninput="A.rcField('servings',Math.max(1,+this.value||1))"></label>
        </div>
        <div class="xs mut num" style="margin-bottom:10px">Per serving: <b style="color:var(--tx)">${r0(tot.kcal)} kcal</b> · P ${r0(tot.p)}g · C ${r0(tot.c)}g · F ${r0(tot.f)}g</div>
        <div class="card" style="padding:8px 12px">
          ${rc.items.map((it, idx) => {
            const f = FOOD[it.foodId];
            return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="sp sm">${esc(f ? f.name : '?')}</span><input type="number" style="width:74px;min-height:34px;padding:4px 6px;text-align:center" value="${it.grams}" oninput="A.rcGrams(${idx},this.value)"><span class="xs mut">g</span><button class="ico ghost bad" onclick="A.rcDelItem(${idx})">✕</button></div>`;
          }).join('') || '<div class="mut xs" style="padding:8px 0">Add ingredients below</div>'}
          <div class="row" style="margin-top:8px"><select id="rc_add_sel">${S.foods.map(f => `<option value="${f.id}">${esc(f.name)} (${f.srvG}g)</option>`).join('')}</select><button class="sm" onclick="A.rcAddItem()">+ Add</button></div>
        </div>
        <div class="g2" style="margin-top:12px">${m.id ? '<button class="bad" onclick="A.delRecipe()">Delete</button>' : '<button onclick="A.closeModal()">Cancel</button>'}<button class="pri" onclick="A.saveRecipe()">Save meal</button></div>
      </div></div>`;
    }
    return '';
  }

  function foodPickList() {
    const m = ui.modal, q = (m.q || '').toLowerCase();
    return S.foods.filter(f => (!m.cat || f.cat === m.cat) && f.name.toLowerCase().includes(q)).slice(0, 45).map(f => {
      const n = C.foodNutrients(f, f.srvG);
      return `<div class="li" onclick="A.pickFood('${f.id}')"><div class="sp"><div class="sm">${esc(f.name)}</div><div class="xs mut num">${esc(f.srvLabel)} · P ${r0(n.p)} · C ${r0(n.c)} · F ${r0(n.f)}</div></div><b class="sm num">${r0(n.kcal)}</b></div>`;
    }).join('') || '<div class="mut sm" style="padding:12px 0">No match — tap ＋ to create a custom food.</div>';
  }

  // ---------- render ----------
  const TABS = [['log', ICONS.log, 'Log'], ['plan', ICONS.plan, 'Plan'], ['body', ICONS.body, 'Body'], ['data', ICONS.data, 'Data']];
  function render() {
    const y = window.scrollY; reindex();
    const v = { log: viewLog, plan: viewPlan, body: viewBody, data: viewData }[ui.tab]();
    $('#app').innerHTML = v + (ui.modal ? modalHTML() : '');
    $('#tabs').innerHTML = TABS.map(([k, i, l]) => `<button class="${ui.tab === k ? 'on' : ''}" onclick="A.go('${k}')"><span class="ti">${i}</span>${l}</button>`).join('');
    window.scrollTo(0, y);
  }

  window.ui_hideTip = () => { ui.tipHidden = true; render(); };
  window.ui_toggleMicros = () => { ui.microsOpen = !ui.microsOpen; render(); };
  window.ui_foodQ = (v) => { ui.foodQ = v; render(); };
  window.ui_foodCat = (c) => { ui.foodCat = c; render(); };

  // ---------- actions ----------
  const A = window.A = {
    go(t) { ui.tab = t; ui.modal = null; ui.wiz = null; render(); window.scrollTo(0, 0); },
    reRender: render,
    shiftDay(d) { ui.date = C.addDays(ui.date, d); render(); },
    toggleRem() { S.settings.showRemaining = !S.settings.showRemaining; save(); render(); },
    addWater(oz) { S.water[ui.date] = Math.max(0, (S.water[ui.date] || 0) + oz); save(); render(); },
    copyYesterday() {
      const yk = C.addDays(ui.date, -1), prev = S.logs[yk] || [];
      if (!prev.length) { toast('Nothing logged yesterday'); return; }
      S.logs[ui.date] = (S.logs[ui.date] || []).concat(prev.map(e => Object.assign(clone(e), { id: C.uid() })));
      save(); toast(`Copied ${prev.length} item${prev.length === 1 ? '' : 's'}`); render();
    },

    // --- Add / Edit Food Entry
    openAdd(meal) { ui.modal = { type: 'add', meal, sub: 'foods', q: '', cat: '', picked: null, qty: 1, unitMode: 'srv' }; render(); },
    addSub(s) { ui.modal.sub = s; ui.modal.picked = null; render(); },
    fq(v) { ui.modal.q = v; $('#fl').innerHTML = foodPickList(); },
    fcat(c) { ui.modal.cat = ui.modal.cat === c ? '' : c; render(); },
    pickFood(id) { ui.modal.picked = id; ui.modal.qty = 1; ui.modal.unitMode = 'srv'; render(); },
    unpickFood() { ui.modal.picked = null; render(); },
    setQty(v) {
      ui.modal.qty = Math.max(0, parseFloat(v) || 0);
      const f = FOOD[ui.modal.picked], grams = ui.modal.unitMode === 'srv' ? ui.modal.qty * f.srvG : ui.modal.qty;
      const n = C.foodNutrients(f, grams), el = $('#a_prev');
      if (el) el.innerHTML = `<div class="kpi"><div class="k-lbl">Kcal</div><div class="k-val">${r0(n.kcal)}</div></div><div class="kpi"><div class="k-lbl">Prot</div><div class="k-val" style="color:var(--p-col)">${r1(n.p)}g</div></div><div class="kpi"><div class="k-lbl">Carb</div><div class="k-val" style="color:var(--c-col)">${r1(n.c)}g</div></div><div class="kpi"><div class="k-lbl">Fat</div><div class="k-val" style="color:var(--f-col)">${r1(n.f)}g</div></div>`;
    },
    setUnitMode(u) {
      const f = FOOD[ui.modal.picked];
      ui.modal.qty = u === 'g' ? r0(ui.modal.qty * f.srvG) : r1(ui.modal.qty / Math.max(1, f.srvG));
      ui.modal.unitMode = u; render();
    },
    commitFood() {
      const m = ui.modal, f = FOOD[m.picked]; if (!f) return;
      const grams = m.unitMode === 'srv' ? m.qty * f.srvG : m.qty;
      if (!(grams > 0)) { toast('Enter an amount > 0'); return; }
      const list = S.logs[ui.date] || (S.logs[ui.date] = []);
      if (m.editId) { const ex = list.find(e => e.id === m.editId); if (ex) { ex.foodId = f.id; ex.grams = r1(grams); } }
      else list.push({ id: C.uid(), meal: m.meal, foodId: f.id, grams: r1(grams) });
      save(); ui.modal = null; render();
    },
    commitQuick() {
      const m = ui.modal, kcal = +$('#q_kcal').value || 0, p = +$('#q_p').value || 0, c = +$('#q_c').value || 0, f = +$('#q_f').value || 0, fiber = +$('#q_fib').value || 0;
      const calcKcal = kcal || r0(p * 4 + c * 4 + f * 9);
      if (!(calcKcal > 0)) { toast('Enter calories or macros'); return; }
      const name = $('#q_name').value.trim() || 'Quick Add';
      const list = S.logs[ui.date] || (S.logs[ui.date] = []);
      if (m.editId) { const ex = list.find(e => e.id === m.editId); if (ex) Object.assign(ex, { name, kcal: calcKcal, p, c, f, fiber }); }
      else list.push({ id: C.uid(), meal: m.meal, quick: true, name, kcal: calcKcal, p, c, f, fiber });
      save(); ui.modal = null; render();
    },
    editEntry(id) {
      const e = (S.logs[ui.date] || []).find(x => x.id === id); if (!e) return;
      if (e.quick) ui.modal = { type: 'add', meal: e.meal, sub: 'quick', editId: id, qName: e.name, qKcal: e.kcal, qP: e.p, qC: e.c, qF: e.f, qFib: e.fiber };
      else ui.modal = { type: 'add', meal: e.meal, sub: 'foods', editId: id, picked: e.foodId, qty: e.grams, unitMode: 'g' };
      render();
    },
    delEntry(id) { S.logs[ui.date] = (S.logs[ui.date] || []).filter(x => x.id !== id); save(); ui.modal = null; render(); },
    logRecipe(rcId, meal) {
      const rc = S.recipes.find(r => r.id === rcId); if (!rc) return;
      const list = S.logs[ui.date] || (S.logs[ui.date] = []);
      const div = Math.max(1, rc.servings || 1);
      rc.items.forEach(it => list.push({ id: C.uid(), meal: meal || 'Lunch', foodId: it.foodId, grams: r1(it.grams / div) }));
      save(); ui.modal = null; toast(`Logged ${rc.name}`); render();
    },
    quickLogRecipe(rcId) { A.logRecipe(rcId, 'Lunch'); ui.tab = 'log'; render(); },

    // --- Goal Wizard & Weekly Check-In
    startWiz(editing) {
      const latestW = S.weights.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
      const baseW = latestW ? latestW.weightLb : S.profile.startWeightLb;
      const g = S.goal || {};
      ui.tab = 'plan';
      ui.wiz = {
        step: 'mode',
        mode: g.mode || 'lose',
        sex: S.profile.sex, age: S.profile.age, heightIn: S.profile.heightIn,
        startWeightLb: baseW, bfPct: latestW?.bf || S.profile.bfPct || '', activity: S.profile.activity,
        targetWeightLb: g.targetWeightLb || r1(baseW * 0.92),
        ratePctWk: g.ratePctWk || 0.75,
        targetDate: g.targetDate || '',
        protTier: g.protTier || 'high',
        split: g.split || 'balanced',
      };
      render(); window.scrollTo(0, 0);
    },
    wizSet(k, v, next) {
      ui.wiz[k] = v;
      if (k === 'mode') {
        if (v === 'lose') { ui.wiz.ratePctWk = 0.75; if (ui.wiz.targetWeightLb >= ui.wiz.startWeightLb) ui.wiz.targetWeightLb = r1(ui.wiz.startWeightLb * 0.92); }
        else if (v === 'gain') { ui.wiz.ratePctWk = 0.25; if (ui.wiz.targetWeightLb <= ui.wiz.startWeightLb) ui.wiz.targetWeightLb = r1(ui.wiz.startWeightLb * 1.06); }
        else { ui.wiz.ratePctWk = 0; ui.wiz.targetWeightLb = ui.wiz.startWeightLb; }
      }
      ui.wiz.step = next; render(); window.scrollTo(0, 0);
    },
    wizBack(to) { if (to === 'cancel') ui.wiz = null; else ui.wiz.step = to; render(); window.scrollTo(0, 0); },
    wizGo(to) { ui.wiz.step = to; render(); window.scrollTo(0, 0); },
    wizF(k, v) { ui.wiz[k] = v; },
    wizHeight(v) { const n = parseFloat(v); if (n > 0) ui.wiz.heightIn = S.settings.unit === 'kg' ? n / C.CM_PER_IN : n; },
    wizWeight(k, v) { const n = parseFloat(v); if (n > 0) ui.wiz[k] = C.toLb(n, S.settings.unit); },
    wizRate(v) { ui.wiz.ratePctWk = v; ui.wiz.targetDate = ''; render(); },
    wizDate(dk) {
      ui.wiz.targetDate = dk;
      if (dk && ui.wiz.mode !== 'maintain' && ui.wiz.targetWeightLb > 0) {
        const days = C.daysBetween(C.dateKey(), dk), diff = Math.abs(ui.wiz.targetWeightLb - ui.wiz.startWeightLb);
        if (days >= 7 && diff > 0.2) ui.wiz.ratePctWk = Math.round(C.clamp(((diff / (days / 7)) / ui.wiz.startWeightLb) * 100, 0.2, 1.25) * 100) / 100;
      }
      render();
    },
    saveWiz() {
      const w = ui.wiz;
      S.profile = { sex: w.sex, age: w.age, heightIn: w.heightIn, startWeightLb: w.startWeightLb, bfPct: w.bfPct, activity: w.activity };
      S.goal = { mode: w.mode, targetWeightLb: w.targetWeightLb, ratePctWk: w.ratePctWk, targetDate: w.targetDate, protTier: w.protTier, split: w.split, startedAt: Date.now() };
      if (!S.weights.length) S.weights.push({ id: C.uid(), date: C.dateKey(), weightLb: r1(w.startWeightLb), bf: w.bfPct || '', note: 'Starting weight' });
      const exp = C.estimateExpenditure(S.profile, S.weights, S.logs, FOOD);
      S.plan = C.buildPlan(S.profile, S.goal, exp.tdee, w.startWeightLb, w.bfPct);
      S.lastCheckIn = Date.now();
      ui.wiz = null; ui.tab = 'log'; save(); toast('Nutrition plan ready'); render(); window.scrollTo(0, 0);
    },
    openCheckIn() { if (!S.goal) { A.startWiz(); return; } ui.modal = { type: 'checkin' }; render(); },
    applyCheckIn() {
      const ci = C.weeklyCheckIn(S.profile, S.goal, S.weights, S.logs, FOOD, S.plan);
      S.plan = ci.proposed; S.lastCheckIn = Date.now();
      save(); ui.modal = null; toast(`Updated to ${ci.proposed.kcal} kcal/day`); render();
    },

    // --- Weigh-ins & Body Comp
    openWeigh(id) {
      const ex = id ? S.weights.find(x => x.id === id) : null;
      const last = S.weights.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
      const w = ex ? { date: ex.date, weightDisp: dispW(ex.weightLb), bf: ex.bf || '', waist: ex.waist || '', neck: ex.neck || '', chest: ex.chest || '', arms: ex.arms || '', hips: ex.hips || '', note: ex.note || '' }
        : { date: C.dateKey(), weightDisp: last ? dispW(last.weightLb) : dispW(S.profile.startWeightLb), bf: '', waist: last?.waist || '', neck: last?.neck || '', chest: '', arms: '', hips: last?.hips || '', note: '' };
      ui.modal = { type: 'weigh', id: id || null, entry: w }; render();
    },
    calcNavy() {
      const waist = C.toIn(parseFloat($('#w_waist').value) || 0, S.settings.unit);
      const neck = C.toIn(parseFloat($('#w_neck').value) || 0, S.settings.unit);
      const hip = C.toIn(parseFloat($('#w_hips').value) || 0, S.settings.unit);
      const bf = C.navyBodyFat({ sex: S.profile.sex, heightIn: S.profile.heightIn, waistIn: waist, neckIn: neck, hipIn: hip });
      if (bf == null) { toast('Enter waist & neck' + (S.profile.sex === 'female' ? ' & hips' : '')); return; }
      $('#w_bf').value = bf; toast(`Estimated ${bf}% body fat`);
    },
    saveWeigh() {
      const wt = parseFloat($('#w_wt').value);
      if (!(wt > 0)) { toast('Enter a valid weight'); return; }
      const obj = {
        id: ui.modal.id || C.uid(), date: $('#w_date').value || C.dateKey(),
        weightLb: r1(C.toLb(wt, S.settings.unit)),
        bf: $('#w_bf').value ? r1(parseFloat($('#w_bf').value)) : '',
        waist: $('#w_waist').value ? r1(parseFloat($('#w_waist').value)) : '',
        neck: $('#w_neck').value ? r1(parseFloat($('#w_neck').value)) : '',
        chest: $('#w_chest').value ? r1(parseFloat($('#w_chest').value)) : '',
        arms: $('#w_arms').value ? r1(parseFloat($('#w_arms').value)) : '',
        hips: $('#w_hips').value ? r1(parseFloat($('#w_hips').value)) : '',
        note: $('#w_note').value.trim(),
      };
      if (ui.modal.id) { const idx = S.weights.findIndex(x => x.id === ui.modal.id); if (idx >= 0) S.weights[idx] = obj; }
      else S.weights.push(obj);
      save(); ui.modal = null; toast('Weigh-in saved'); render();
    },
    delWeigh(id) { if (confirm('Delete this weigh-in?')) { S.weights = S.weights.filter(x => x.id !== id); save(); render(); } },

    // --- Recipes / Custom Foods
    openRecipe(id) {
      const rc = id ? clone(S.recipes.find(r => r.id === id)) : { id: C.uid(), name: '', servings: 1, items: [] };
      ui.modal = { type: 'recipe', id: id || null, rc }; render();
    },
    rcField(k, v) { ui.modal.rc[k] = v; },
    rcAddItem() {
      const fid = $('#rc_add_sel').value, f = FOOD[fid]; if (!f) return;
      ui.modal.rc.items.push({ foodId: fid, grams: f.srvG }); render();
    },
    rcGrams(i, v) { ui.modal.rc.items[i].grams = Math.max(0, parseFloat(v) || 0); },
    rcDelItem(i) { ui.modal.rc.items.splice(i, 1); render(); },
    saveRecipe() {
      const rc = ui.modal.rc;
      if (!rc.name.trim()) { toast('Enter a meal name'); return; }
      if (!rc.items.length) { toast('Add at least one ingredient'); return; }
      if (ui.modal.id) { const idx = S.recipes.findIndex(r => r.id === ui.modal.id); if (idx >= 0) S.recipes[idx] = rc; }
      else S.recipes.push(rc);
      save(); ui.modal = null; toast('Meal saved'); render();
    },
    delRecipe() { S.recipes = S.recipes.filter(r => r.id !== ui.modal.id); save(); ui.modal = null; render(); },

    openFoodEdit(id, fromAdd) {
      const f = id ? clone(FOOD[id]) : { name: '', cat: 'Other', srvLabel: '100 g', srvG: 100, kcal: 0, p: 0, c: 0, f: 0, fiber: 0, na: 0, k: 0, ca: 0, fe: 0, vitd: 0 };
      ui.modal = { type: 'foodEdit', id: id || null, food: f, back: fromAdd ? ui.modal : null }; render();
    },
    saveFood() {
      const name = $('#fe_name').value.trim(); if (!name) { toast('Name required'); return; }
      const f = {
        id: ui.modal.id || ('u_' + C.uid()), name, cat: $('#fe_cat').value, srvLabel: $('#fe_sl').value.trim() || '100 g',
        srvG: Math.max(1, +$('#fe_sg').value || 100), kcal: +$('#fe_kcal').value || 0, p: +$('#fe_p').value || 0, c: +$('#fe_c').value || 0, f: +$('#fe_f').value || 0,
        fiber: +$('#fe_fib').value || 0, na: +$('#fe_na').value || 0, k: +$('#fe_k').value || 0, ca: ui.modal.food.ca || 0, fe: ui.modal.food.fe || 0, vitd: ui.modal.food.vitd || 0,
      };
      if (ui.modal.id) Object.assign(FOOD[ui.modal.id], f); else S.foods.push(f);
      save(); reindex();
      ui.modal = ui.modal.back || null;
      if (ui.modal) { ui.modal.picked = f.id; ui.modal.qty = 1; ui.modal.unitMode = 'srv'; }
      toast('Food saved'); render();
    },
    delFood() { if (confirm('Delete this food?')) { S.foods = S.foods.filter(f => f.id !== ui.modal.id); save(); ui.modal = null; render(); } },
    closeModal() { ui.modal = null; render(); },

    // --- Data / Settings
    setting(k, v) { S.settings[k] = v; save(); render(); },
    setWaterGoal(v) { const n = +v || 0; S.settings.waterGoalOz = S.settings.waterUnit === 'ml' ? r0(n / 29.5735) : r0(n); save(); render(); },
    expDiaryCSV() { shareOrDownload('openmacros-diary-' + C.dateKey() + '.csv', C.diaryToCSV(S.logs, FOOD), 'text/csv'); render(); },
    expBioCSV() { shareOrDownload('openmacros-body-' + C.dateKey() + '.csv', C.biometricsToCSV(S.weights, S.settings.unit), 'text/csv'); render(); },
    expJSON() { shareOrDownload('openmacros-backup-' + C.dateKey() + '.json', JSON.stringify(S), 'application/json'); render(); },
    restore(inp) {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const j = JSON.parse(rd.result);
          if (!j || !j.v || !Array.isArray(j.foods) || typeof j.logs !== 'object') throw new Error('Not an openMACROS backup');
          if (!confirm('Restore this backup? Everything currently on this device will be replaced.')) return;
          S = Object.assign(fresh(), j); save(); reindex(); ui.tab = 'log'; render(); toast('Backup restored');
        } catch (e) { alert('Restore failed: ' + e.message); }
      };
      rd.readAsText(f);
    },
    reset() { if (confirm('Erase ALL openMACROS data on this device?') && confirm('Really erase everything?')) { S = fresh(); save(); reindex(); render(); } },
  };

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  render();
  window.__S = () => S;
})();
