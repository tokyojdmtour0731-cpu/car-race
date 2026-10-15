"use strict";
// Car Race (Cycle 3): three fictional cars, upgrade parts, virtual coins (no real money). Runs before main.js.
(function () {
  const P = window.CarPhysics;
  if (!P) return;
  const base = Object.assign({}, P.CAR_KAZE);
  const CARS = [
    Object.assign({}, base, { name: "Kaze FR (fictional)" }),
    Object.assign({}, base, { name: "Raiden AWD (fictional)", mass: 1450, wheelbase: 2.65, frontWeight: 0.57, track: 1.55, hCg: 0.48, iz: 2900, cdA: 0.76, tireMu: 1.15, drive: "AWD", diffLock: 0.4, gears: [3.5, 2.1, 1.45, 1.1, 0.9, 0.74], final: 3.7, redline: 7200, torqueCurve: [[900, 160], [2000, 260], [3000, 400], [4000, 440], [5000, 430], [6000, 400], [6800, 350], [7200, 300]], brakeTorque: 6200, brakeBias: 0.64, rollStiffFront: 0.58 }),
    Object.assign({}, base, { name: "Tsubame FF (fictional)", mass: 1050, wheelbase: 2.45, frontWeight: 0.62, track: 1.45, hCg: 0.45, iz: 1700, cdA: 0.66, tireMu: 1.08, drive: "FWD", diffLock: 0.2, gears: [3.4, 2.1, 1.5, 1.18, 0.97, 0.82], final: 4.2, redline: 8200, torqueCurve: [[1000, 110], [2500, 160], [4000, 200], [5500, 235], [6500, 245], [7500, 230], [8200, 200]], brakeTorque: 4300, brakeBias: 0.68, rollStiffFront: 0.6 })
    ];
  window.GarageCars = CARS; if (location.search.indexOf("test=1") >= 0) return;
  const KEY = "carrace_garage_c3";
  const MAXLV = 3;
  let st = { car: 0, coins: 0, up: [], best: {} };
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === "object") st = Object.assign(st, s);
  } catch (e) { }
  if (!Array.isArray(st.up)) st.up = [];
  for (let i = 0; i < CARS.length; i++) st.up[i] = Object.assign({ eng: 0, tire: 0, wt: 0 }, st.up[i]);
  if (!(st.car >= 0 && st.car < CARS.length)) st.car = 0;
  if (!st.best || typeof st.best !== "object") st.best = {};
  if (!(st.coins >= 0)) st.coins = 0;

 function save() {
   try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { }
 }
  function cost(lv) { return 100 * (lv + 1); }
  function apply() {
    const c = CARS[st.car];
    const u = st.up[st.car];
    const p = Object.assign({}, c);
    p.torqueCurve = c.torqueCurve.map(function (q) { return [q[0], q[1] * (1 + 0.04 * u.eng)]; });
    p.tireMu = c.tireMu + 0.04 * u.tire;
    p.mass = c.mass * (1 - 0.03 * u.wt);
    Object.assign(P.CAR_KAZE, p);
    try { localStorage.setItem("carrace_best_c2", String(st.best[st.car] || 0)); } catch (e) { }
  }
  apply();

 const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:12px;bottom:34px;font-size:12px;line-height:1.5;white-space:pre;text-shadow:0 0 4px #000;pointer-events:none;color:#dfe6f0";
  document.body.appendChild(el);
  function lv(n) { return "#".repeat(n) + "-".repeat(MAXLV - n); }
  function price(n) { return n < MAXLV ? String(cost(n)) : "MAX"; }
  function render() {
    const u = st.up[st.car];
    el.textContent = "GARAGE  CAR: " + CARS[st.car].name + "  " + CARS[st.car].drive + "  " + CARS[st.car].mass.toFixed(0) + " kg  COINS: " + st.coins + " (virtual)\n" +
      "Z: next car  X: engine [" + lv(u.eng) + "] " + price(u.eng) + "  C: tires [" + lv(u.tire) + "] " + price(u.tire) + "  V: weight [" + lv(u.wt) + "] " + price(u.wt);
  }
  render();

 window.addEventListener("keydown", function (e) {
   if (e.repeat) return;
   const u = st.up[st.car];
   let key = "";
   if (e.code === "KeyZ") {
     st.car = (st.car + 1) % CARS.length;
     save();
     location.reload();
     return;
   }
   if (e.code === "KeyX") key = "eng";
   if (e.code === "KeyC") key = "tire";
   if (e.code === "KeyV") key = "wt";
   if (key && u[key] < MAXLV && st.coins >= cost(u[key])) {
     st.coins -= cost(u[key]);
     u[key]++;
     save();
     location.reload();
   }
 });

 window.addEventListener("carrace:lap", function (e) {
   const t = e.detail.time;
   st.coins += 100;
   if (!st.best[st.car] || t < st.best[st.car]) {
     st.best[st.car] = t;
     st.coins += 50;
   }
   save();
   render();
 });
})();
