"use strict";
// Automatic measurements for the physics prototype. Open the page with ?test=1 to run.
(function (root) {
  const P = root.CarPhysics;
  const KMH = 3.6;

 function newCar(tc) {
   const car = P.createCar(P.CAR_KAZE);
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

 function testAccel() {
   const car = newCar(true);
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

 function testTopSpeed() {
   const car = newCar(true);
   const n = Math.round(240 / P.DT);
   const mark = n - Math.round(10 / P.DT);
   let vMark = 0;
   for (let i = 0; i < n; i++) {
     P.step(car, { throttle: 1, brake: 0, steer: 0 }, P.DT);
     if (i === mark) vMark = car.vx;
   }
   return { vmax: car.vx * KMH, dv10: (car.vx - vMark) * KMH };
 }

 function brakeRun(abs) {
   const car = newCar(false);
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

 function testSkidpad() {
   const R0 = 50;
   const car = newCar(false);
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

 function testIdle() {
   const car = newCar(false);
   for (let i = 0; i < 5 * 240; i++) P.step(car, { throttle: 0, brake: 0, steer: 0 }, P.DT);
   return Math.hypot(car.x, car.y);
 }

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
