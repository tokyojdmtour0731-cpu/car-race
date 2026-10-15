"use strict";
// Car Race (Cycle 4): local ghost of your best lap per car (stored in this browser only).
(function () {
  if (location.search.indexOf("test=1") >= 0) return;
  let idx = 0;
  try {
    const g = JSON.parse(localStorage.getItem("carrace_garage_c3"));
    if (g && g.car >= 0) idx = g.car | 0;
  } catch (e) { }
  const KEY = "carrace_ghost_c4_" + idx;
  const INTERVAL = 0.05;
  let ghost = null;
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.d && s.d.length >= 8 && s.time > 0) ghost = s;
  } catch (e) { }
  let buf = [];
  let lastStart = -1;
  let lastRec = -1;
  let gi = 0;

 const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:12px;bottom:76px;font-size:12px;white-space:pre;text-shadow:0 0 4px #000;pointer-events:none;color:#ffd23f";
  document.body.appendChild(el);
  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(3);
  }
  function showText() {
    el.textContent = ghost ? "GHOST (yellow car): your best lap with this car " + fmt(ghost.time) : "GHOST: none yet - finish a valid lap to record one";
  }
  showText();

 function sample(S) {
   const car = S.car;
   const lap = S.lap;
   if (!lap.running) {
     buf = [];
     lastStart = -1;
     lastRec = -1;
     return;
   }
   if (lap.start !== lastStart) {
     buf = [];
     lastStart = lap.start;
     lastRec = -1;
   }
   const t = car.time - lap.start;
   if (lastRec < 0 || t - lastRec >= INTERVAL) {
     buf.push(+t.toFixed(3), +car.x.toFixed(2), +car.y.toFixed(2), +car.psi.toFixed(3));
     lastRec = t;
   }
 }

 window.addEventListener("carrace:lap", function (e) {
   const t = e.detail.time;
   const S = window.RaceState;
   if (!S || buf.length < 8) return;
   if (ghost && ghost.time <= t) return;
   const d = buf.slice();
   d.push(+t.toFixed(3), +S.car.x.toFixed(2), +S.car.y.toFixed(2), +S.car.psi.toFixed(3));
   ghost = { time: t, d: d };
   gi = 0;
   try { localStorage.setItem(KEY, JSON.stringify(ghost)); } catch (err) { }
   showText();
 });

 window.GhostDraw = function (ctx) {
   const S = window.RaceState;
   if (!S) return;
   sample(S);
   if (!ghost) return;
   const d = ghost.d;
   const n = d.length / 4;
   const t = S.lap.running ? S.car.time - S.lap.start : 0;
   if (t > ghost.time + 1) return;
   if (gi >= n - 1 || t < d[gi * 4]) gi = 0;
   while (gi < n - 2 && d[(gi + 1) * 4] < t) gi++;
   const k = gi * 4;
   const dt = d[k + 4] - d[k];
   const f = dt > 1e-6 ? Math.min(1, Math.max(0, (t - d[k]) / dt)) : 0;
   const x = d[k + 1] + (d[k + 5] - d[k + 1]) * f;
   const y = d[k + 2] + (d[k + 6] - d[k + 2]) * f;
   const psi = d[k + 3] + (d[k + 7] - d[k + 3]) * f;
   ctx.save();
   ctx.translate(x, y);
   ctx.rotate(psi);
   ctx.fillStyle = "rgba(255,210,63,0.55)";
   ctx.fillRect(-S.car.b - 0.9, -0.9, S.car.a + S.car.b + 1.75, 1.8);
   ctx.restore();
 };
})();
