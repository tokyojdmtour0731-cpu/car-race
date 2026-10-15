"use strict";
// Automatic measurements for the physics prototype. Open the page with ?test=1 to run.
(function (root) {
  const P = root.CarPhysics;
  const KMH = 3.6;

 function newCar(tc, ov) {
   const car = P.createCar(ov ? Object.assign({}, P.CAR_KAZE, ov) : P.CAR_KAZE);
   car.auto = true;
   car.abs = true;
   car.tc = !!tc;
   return car;
 }

 function wrapPi(a) {
   while (a > Math.PI) a -= 2 * Math.PI;
   while (a < -Math.PI) a += 2 * Math.PI;
   return a;
 }

 function testAccel(ov) {
   const car = newCar(true, ov);
   let t100 = NaN;
   let t200 = NaN;
   const n = Math.round(40 / P.DT);
   for (let i = 0; i < n; i++) {
     P.step(car, { throttle: 1, brake: 0, steer: 0 }, P.DT);
     const k = car.vx * KMH;
     if (isNaN(t100) && k >= 100) t100 = car.time;
     if (isNaN(t200) && k >= 200) t200 = car.time;
   }
   return { t100: t100, t200: t200 };
 }

 function testTopSpeed(ov) {
   const car = newCar(true, ov);
   const n = Math.round(240 / P.DT);
   const mark = n - Math.round(10 / P.DT);
   let vMark = 0;
   for (let i = 0; i < n; i++) {
     P.step(car, { throttle: 1, brake: 0, steer: 0 }, P.DT);
     if (i === mark) vMark = car.vx;
   }
   return { vmax: car.vx * KMH, dv10: (car.vx - vMark) * KMH };
 }

 function brakeRun(abs, ov) {
   const car = newCar(false, ov);
   car.auto = false;
   car.gear = 4;
   car.abs = abs;
   const v0 = 100 / KMH;
   car.vx = v0;
   for (let i = 0; i < 4; i++) car.omega[i] = v0 / car.p.wheelR;
   const x0 = car.x;
   let n = 0;
   while (car.vx > 0.3 && n < 30 * 240) {
     P.step(car, { throttle: 0, brake: 1, steer: 0 }, P.DT);
     n++;
   }
   return car.x - x0;
 }

 function testSkidpad(ov) {
   const R0 = 50;
   const car = newCar(false, ov);
   car.vx = 12;
   car.gear = 3;
   for (let i = 0; i < 4; i++) car.omega[i] = 12 / car.p.wheelR;
   let avg = 0;
   let maxG = 0;
   let lostAt = NaN;
   let lostSpeed = NaN;
   const n = Math.round(90 / P.DT);
   for (let i = 0; i < n; i++) {
     const t = car.time;
     const vt = 12 + 0.4 * t;
     const dx = car.x;
     const dy = car.y - R0;
     const e = Math.hypot(dx, dy) - R0;
     const psiDes = Math.atan2(dy, dx) + Math.PI / 2;
     const ePsi = wrapPi(psiDes - car.psi);
     const del = Math.atan(car.p.wheelbase / R0) + 0.02 * e + 0.6 * ePsi;
     const sm = P.steerMax(car.p, Math.max(0, car.vx));
     const ev = vt - car.vx;
     P.step(car, { throttle: P.clamp(0.25 + 0.5 * ev, 0, 1), brake: P.clamp(-0.3 * ev, 0, 1), steer: P.clamp(del / sm, -1, 1) }, P.DT);
     avg += (Math.abs(car.gLat) - avg) * (P.DT / 0.5);
     if (Math.abs(e) < 3 && t > 2) maxG = Math.max(maxG, avg);
     if (Math.abs(e) > 5) {
       lostAt = car.time;
       lostSpeed = car.vx * KMH;
       break;
     }
   }
   return { maxG: maxG, lostAt: lostAt, lostSpeed: lostSpeed };
 }
function kbCircle(ov, assist, kmh) { const R0 = 100; const car = newCar(false, ov); const v0 = kmh / KMH; car.vx = v0; car.gear = 3; for (let i = 0; i < 4; i++) car.omega[i] = v0 / car.p.wheelR; const inp = { throttle: 0, brake: 0, steer: 0 }; let maxE = 0; let lost = 40; let kst = 0; let next = 0; const n = Math.round(40 / P.DT); for (let k = 0; k < n; k++) { const t = car.time; const dx = car.x; const dy = car.y - R0; const e = Math.hypot(dx, dy) - R0; const ePsi = wrapPi(Math.atan2(dy, dx) + Math.PI / 2 - car.psi); const del = Math.atan(car.p.wheelbase / R0) + 0.02 * e + 0.6 * ePsi; const vx = Math.max(0, car.vx); const sm = P.steerMax(car.p, vx); const lim = assist ? Math.min(1, (0.045 + 27.5 / (car.vx * car.vx + 25)) / sm) : 1; if (t >= next) { next = t + 0.1; if (del - car.steer > 0.01) kst = 1; else if (car.steer - del > 0.01) kst = -1; else kst = 0; } const rate = (kst !== 0 ? 3.0 / (1 + vx / 30) : 5) * P.DT; const tg = kst * lim; const d = tg - inp.steer; inp.steer = Math.abs(d) <= rate ? tg : inp.steer + Math.sign(d) * rate; const ev = v0 - car.vx; inp.throttle = P.clamp(0.25 + 0.5 * ev, 0, 1); inp.brake = P.clamp(-0.3 * ev, 0, 1); P.step(car, inp, P.DT); if (t > 3) maxE = Math.max(maxE, Math.abs(e)); if (Math.abs(e) > 6) { lost = car.time; break; } } return { maxE: maxE, lost: lost }; }
 function testIdle() {
   const car = newCar(false);
   for (let i = 0; i < 5 * 240; i++) P.step(car, { throttle: 0, brake: 0, steer: 0 }, P.DT);
   return Math.hypot(car.x, car.y);
 }
function revRun() { const car = newCar(false); car.rev = true; car.gear = 1; car.auto = false; let vmin = 0; for (let i = 0; i < 10 * 240; i++) { P.step(car, { throttle: 1, brake: 0, steer: 0 }, P.DT); vmin = Math.min(vmin, car.vx); } const xr = car.x; for (let j = 0; j < 8 * 240; j++) P.step(car, { throttle: 0, brake: 1, steer: 0 }, P.DT); return { vmin: vmin * KMH, x: xr, vEnd: car.vx * KMH, y: car.y }; }
  function spinRun(tc, kmh, thr, ctl) { const R0 = 100; const car = newCar(tc); const v0 = kmh / KMH; car.vx = v0; car.gear = 3; for (let i = 0; i < 4; i++) car.omega[i] = v0 / car.p.wheelR; let maxB = 0; let sLast = 0; const n = Math.round(8 / P.DT); for (let k = 0; k < n; k++) { const t = car.time; const dx = car.x; const dy = car.y - R0; const e = Math.hypot(dx, dy) - R0; const ePsi = wrapPi(Math.atan2(dy, dx) + Math.PI / 2 - car.psi); const del = Math.atan(car.p.wheelbase / R0) + 0.02 * e + 0.6 * ePsi; const sm = P.steerMax(car.p, Math.max(0, car.vx)); let st = P.clamp(del / sm, -1, 1); let th = 0; let br = 0; if (t < 3) { const ev = v0 - car.vx; th = P.clamp(0.25 + 0.5 * ev, 0, 1); br = P.clamp(-0.3 * ev, 0, 1); sLast = st; } else { if (!ctl) st = sLast; th = thr; } P.step(car, { throttle: th, brake: br, steer: st }, P.DT); if (t >= 3) maxB = Math.max(maxB, Math.abs(Math.atan2(car.vy, Math.max(1, car.vx)))); } return maxB * 57.3; }
  
 function runAll() {
   const out = [];
   function add(name, val, unit, min, max) {
     const ok = typeof val === "number" && isFinite(val) && (min === null || val >= min) && (max === null || val <= max);
     out.push({ name: name, value: val, unit: unit, min: min, max: max, pass: ok });
   }
   const a = testAccel();
   add("0-100 km/h", a.t100, "s", 4.5, 6.8);
   add("0-200 km/h", a.t200, "s", 13, 28);
   const ts = testTopSpeed();
   add("Top speed", ts.vmax, "km/h", 235, 290);
   add("Top speed settled (dv over last 10 s)", ts.dv10, "km/h", -1, 1);
   add("100-0 km/h braking distance (ABS on)", brakeRun(true), "m", 33, 44);
   add("100-0 km/h braking distance (ABS off, info)", brakeRun(false), "m", 33, 60);
   const sp = testSkidpad();
   add("Max lateral G (R=50 m circle)", sp.maxG, "g", 0.95, 1.25);
   add("Skidpad speed at loss of line (info)", sp.lostSpeed, "km/h", 50, 110);
   add("Standstill drift in 5 s", testIdle(), "m", 0, 0.05);
   const gc = root.GarageCars || [];
   for (let ci = 1; ci < gc.length; ci++) { add("Car " + ci + " " + gc[ci].name + " 100-0 braking (ABS on)", brakeRun(true, gc[ci]), "m", 30, 48); add("Car " + ci + " 100-0 braking (ABS off, info)", brakeRun(false, gc[ci]), "m", 30, 70); }
   for (let cj = 1; cj < gc.length; cj++) { const ac = testAccel(gc[cj]); const tp = testTopSpeed(gc[cj]); const sk = testSkidpad(gc[cj]); add("Car " + cj + " 0-100 km/h", ac.t100, "s", 3, 9); add("Car " + cj + " 0-200 km/h", ac.t200, "s", 8, 40); add("Car " + cj + " top speed", tp.vmax, "km/h", 180, 320); add("Car " + cj + " max lateral G", sk.maxG, "g", 0.8, 1.4); add("Car " + cj + " skidpad limit speed", sk.lostSpeed, "km/h", 40, 130); }
   for (let kk = 0; kk < 3; kk++) { const sp2 = [60, 80, 100][kk]; const on = kbCircle(null, true, sp2); const off = kbCircle(null, false, sp2); add("Keyboard driver R=100m " + sp2 + "km/h assist ON max offset", on.maxE, "m", 0, 6); add("Keyboard driver R=100m " + sp2 + "km/h assist ON seconds on road", on.lost, "s", 40, 40); add("Keyboard driver R=100m " + sp2 + "km/h assist OFF max offset (info)", off.maxE, "m", 0, 100); add("Keyboard driver R=100m " + sp2 + "km/h assist OFF seconds on road (info)", off.lost, "s", 0, 100); }
   const cinfo = (function () { const C = [[0, 0], [250, 0], [500, 10], [700, 60], [850, 180], [900, 330], [820, 450], [680, 480], [560, 420], [450, 460], [330, 540], [180, 560], [50, 500], [-60, 380], [-100, 230], [-80, 90]]; const cr = function (a, b, c, d, t) { const t2 = t * t; const t3 = t2 * t; return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3); }; const D = []; for (let i = 0; i < C.length; i++) { const p0 = C[(i + C.length - 1) % C.length]; const p1 = C[i]; const p2 = C[(i + 1) % C.length]; const p3 = C[(i + 2) % C.length]; for (let k = 0; k < 40; k++) { const t = k / 40; D.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]); } } let kmax = 0; let tight = 0; const n = D.length; for (let i = 0; i < n; i++) { const a = D[(i + n - 4) % n]; const b = D[i]; const c = D[(i + 4) % n]; const ab = Math.hypot(b[0] - a[0], b[1] - a[1]); const bc = Math.hypot(c[0] - b[0], c[1] - b[1]); const ca = Math.hypot(a[0] - c[0], a[1] - c[1]); const cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); const kk2 = 2 * cross / (ab * bc * ca + 1e-9); kmax = Math.max(kmax, kk2); if (kk2 > 1 / 120) tight++; } const rmin = 1 / kmax; return { rmin: rmin, vlim: Math.sqrt(9.81 * rmin) * KMH, frac: tight / n }; })();
   add("Course tightest corner radius (info)", cinfo.rmin, "m", 10, 500); add("Course speed limit at tightest corner at 1.0 g (info)", cinfo.vlim, "km/h", 10, 300); add("Course share of samples with radius under 120 m (info)", cinfo.frac, "ratio", 0, 1);
   const rv = revRun(); add("Reverse peak speed in 10 s (negative = backward)", rv.vmin, "km/h", -70, -15); add("Reverse distance in 10 s (negative = backward)", rv.x, "m", -400, -30); add("Reverse then brake: final speed", rv.vEnd, "km/h", -1, 1); add("Reverse sideways drift on straight", Math.abs(rv.y), "m", 0, 1); add("Spin test 70km/h full throttle, steering corrected, TC off, max sideslip (info)", spinRun(false, 70, 1, true), "deg", 0, 180); add("Spin test 70km/h full throttle, steering corrected, TC on, max sideslip (info)", spinRun(true, 70, 1, true), "deg", 0, 180); add("Spin test 70km/h full throttle, steering frozen, TC off, max sideslip (info)", spinRun(false, 70, 1, false), "deg", 0, 180); add("Spin test 70km/h full throttle, steering frozen, TC on, max sideslip (info)", spinRun(true, 70, 1, false), "deg", 0, 180); add("Spin test 100km/h lift-off, steering frozen, TC off, max sideslip (info)", spinRun(false, 100, 0, false), "deg", 0, 180); add("Spin test 100km/h lift-off, steering corrected, TC off, max sideslip (info)", spinRun(false, 100, 0, true), "deg", 0, 180);
   return out;
 }

 function render() {
   const res = runAll();
   const lines = [];
   let pass = 0;
   for (let i = 0; i < res.length; i++) {
     const r = res[i];
     if (r.pass) pass++;
     const v = typeof r.value === "number" && isFinite(r.value) ? r.value.toFixed(2) : String(r.value);
     lines.push((r.pass ? "[PASS] " : "[FAIL] ") + r.name + ": " + v + " " + r.unit + "  (range " + r.min + " to " + r.max + ")");
   }
   const head = "RESULT " + pass + "/" + res.length + " passed";
   const el = document.getElementById("results");
   el.style.display = "block";
   el.textContent = head + "\n" + lines.join("\n") + "\n\nJSON: " + JSON.stringify(res);
   document.title = head;
   root.__results = res;
   return res;
 }

 root.CarTests = { runAll: runAll, render: render };
})(typeof window !== "undefined" ? window : globalThis);
