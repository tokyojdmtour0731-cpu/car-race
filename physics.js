"use strict";
// Car Race physics prototype (Cycle 1). Fictional car, simplified 4-wheel planar model.
// Fixed time step 1/240 s, no randomness (deterministic: replays reproduce the same run).
(function (root) {
  const G = 9.81;
  const RHO = 1.2;
  const TWO_PI = Math.PI * 2;
  const DT = 1 / 240;
  const MAGIC_B = 2.3;
  const MAGIC_C = 1.35;

 const CAR_KAZE = {
   name: "Kaze FR (fictional)",
   mass: 1250,
   wheelbase: 2.55,
   frontWeight: 0.53,
   track: 1.5,
   hCg: 0.46,
   iz: 2300,
   wheelR: 0.32,
   wheelI: 1.6,
   cdA: 0.72,
   clA: 0.25,
   crr: 0.015,
   tireMu: 1.1,
   loadSens: 0.08,
   kappaPeak: 0.12,
   tanAlphaPeak: 0.17,
   drive: "RWD",
   diffLock: 0.35,
   gears: [3.6, 2.2, 1.5, 1.15, 0.92, 0.76],
   final: 3.9,
   driveEff: 0.9,
   idle: 900,
   redline: 7500,
   torqueCurve: [[900, 150], [2000, 230], [3000, 290], [4000, 330], [4800, 350], [5600, 345], [6500, 320], [7200, 285], [7500, 260]],
   brakeTorque: 6500,
   brakeBias: 0.62,
   maxSteer: 0.55,
   rollStiffFront: 0.55
 };

 function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

 function lerpCurve(c, x) {
   if (x <= c[0][0]) return c[0][1];
   for (let i = 1; i < c.length; i++) {
     if (x <= c[i][0]) {
       const t = (x - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
       return c[i - 1][1] + t * (c[i][1] - c[i - 1][1]);
     }
   }
   return c[c.length - 1][1];
 }

 // normalized tire curve: peak value 1 at s = 1, sliding value about 0.85
 function magic(s) {
   return Math.sin(MAGIC_C * Math.atan(MAGIC_B * s));
 }

 function createCar(p) {
   const car = {
     p: p, x: 0, y: 0, psi: 0, vx: 0, vy: 0, r: 0,
     omega: [0, 0, 0, 0], steer: 0, gear: 1, rpm: p.idle,
     ax: 0, ay: 0, shiftTimer: 0, time: 0,
     auto: true, abs: true, tc: false,
     kap: [0, 0, 0, 0], alp: [0, 0, 0, 0], fz: [0, 0, 0, 0],
     gLong: 0, gLat: 0, throttleEff: 0
   };
   const L = p.wheelbase;
   car.fz0 = p.mass * G / 4;
   car.a = L * (1 - p.frontWeight);
   car.b = L * p.frontWeight;
   car.pos = [[car.a, p.track / 2], [car.a, -p.track / 2], [-car.b, p.track / 2], [-car.b, -p.track / 2]];
   return car;
 }

 function resetCar(car, x, y, psi) {
   car.x = x; car.y = y; car.psi = psi;
   car.vx = 0; car.vy = 0; car.r = 0;
   car.omega = [0, 0, 0, 0];
   car.steer = 0; car.gear = 1; car.rpm = car.p.idle;
   car.ax = 0; car.ay = 0; car.shiftTimer = 0; car.time = 0;
 }

 function shift(car, dir) {
   const n = clamp(car.gear + dir, 1, car.p.gears.length);
   if (n !== car.gear) {
     car.gear = n;
     car.shiftTimer = 0.18;
   }
 }

 function steerMax(p, v) {
   return p.maxSteer / (1 + Math.pow(v / 22, 2)) + 0.045;
 }

 function tireForce(car, Fz, vl, vt, omega) {
   const p = car.p;
   const R = p.wheelR;
   if (Fz <= 1) return { fx: 0, fy: 0, kappa: 0, tanA: 0, dFdw: 0 };
   const vref = Math.max(Math.abs(vl), 1.0);
   const kappa = (omega * R - vl) / vref;
   const tanA = vt / vref;
   const muEff = p.tireMu * Math.max(0.6, 1 - p.loadSens * (Fz / car.fz0 - 1));
   const sx = kappa / p.kappaPeak;
   const sy = tanA / p.tanAlphaPeak;
   const s = Math.hypot(sx, sy);
   let f = 0;
   if (s > 1e-6) f = muEff * Fz * magic(s) / s;
   if (s > 1.8) f *= 1 - 0.15 * Math.min(1, (s - 1.8) / 3);
   const dFdw = muEff * Fz * MAGIC_B * MAGIC_C / p.kappaPeak * R / vref;
   return { fx: f * sx, fy: -f * sy, kappa: kappa, tanA: tanA, dFdw: dFdw };
 }

 // inp: { throttle 0..1, brake 0..1, steer -1..1 (left positive) }
 function step(car, inp, dt) {
   const p = car.p;
   const R = p.wheelR;
   const v = car.rev ? Math.abs(car.vx) : Math.max(0, car.vx);

  // steering with rate limit
  const target = clamp(inp.steer, -1, 1) * steerMax(p, v);
   const dmax = 3.0 * dt;
   car.steer += clamp(target - car.steer, -dmax, dmax);

  // drive layout
  let axles;
   if (p.drive === "FWD") axles = [[0, 1, 1.0]];
   else if (p.drive === "AWD") axles = [[0, 1, 0.4], [2, 3, 0.6]];
   else axles = [[2, 3, 1.0]];

  const gr = p.gears[car.gear - 1] * p.final * (car.rev ? 1.25 : 1);
   let wSum = 0;
   let wCnt = 0;
   let kMax = 0;
   for (let a = 0; a < axles.length; a++) {
     for (let k = 0; k < 2; k++) {
       const i = axles[a][k];
       wSum += car.omega[i];
       wCnt++;
       kMax = Math.max(kMax, car.kap[i]);
     }
   }
   const wheelRpmEq = Math.abs(wSum / wCnt) * gr * 60 / TWO_PI;

  let throttle = clamp(inp.throttle, 0, 1);
   const brake = clamp(inp.brake, 0, 1);
   if (car.tc) throttle *= clamp(1 - (kMax - 0.13) * 10, 0.15, 1);
   car.throttleEff = throttle;

  // automatic gearbox
  if (car.auto && !car.rev && car.shiftTimer <= 0) {
    if (wheelRpmEq > 7100 && car.gear < p.gears.length) shift(car, 1);
    else if (car.gear > 1 && wheelRpmEq < 2700) shift(car, -1);
  }
   if (car.shiftTimer > 0) car.shiftTimer -= dt;

  // engine
  const rpmTq = Math.max(wheelRpmEq, p.idle, throttle * (car.gear === 1 ? 3800 : 2200));
   car.rpm = rpmTq;
   let Teng = 0;
   if (car.shiftTimer <= 0) {
     if (rpmTq >= p.redline) Teng = 0;
     else Teng = throttle * lerpCurve(p.torqueCurve, rpmTq);
     if (throttle < 1 && wheelRpmEq > p.idle * 1.2) Teng -= (1 - throttle) * (25 + 0.016 * wheelRpmEq);
   }
   const Twheels = Teng * gr * p.driveEff * 0.97 * (car.rev ? -1 : 1);

  // wheel drive torque with limited slip differential
  const drv = [0, 0, 0, 0];
   for (let a = 0; a < axles.length; a++) {
     const l = axles[a][0];
     const rr = axles[a][1];
     const tAxle = Twheels * axles[a][2];
     const bias = clamp(p.diffLock * 0.4 * (car.omega[l] - car.omega[rr]), -0.35, 0.35);
     drv[l] = tAxle * (0.5 - bias);
     drv[rr] = tAxle * (0.5 + bias);
   }

  // brakes (front/rear bias) with optional ABS
  const brk = [0, 0, 0, 0];
   for (let i = 0; i < 4; i++) {
     const share = i < 2 ? p.brakeBias : 1 - p.brakeBias;
     let tb = brake * p.brakeTorque * share / 2;
     if (car.abs && car.kap[i] < -0.13) tb *= clamp(1 + (car.kap[i] + 0.13) * 12, 0, 1);
     brk[i] = tb;
   }

  // vertical loads (static + aero + load transfer from last step accelerations)
  const fzAero = 0.5 * RHO * p.clA * v * v;
   const sF = p.mass * G * p.frontWeight / 2;
   const sR = p.mass * G * (1 - p.frontWeight) / 2;
   const dLong = p.mass * car.ax * p.hCg / p.wheelbase;
   const dLat = p.mass * car.ay * p.hCg / p.track;
   const dLatF = dLat * p.rollStiffFront;
   const dLatR = dLat * (1 - p.rollStiffFront);
   const Fz = [
     Math.max(0, sF - dLong / 2 - dLatF / 2 + fzAero * 0.225),
     Math.max(0, sF - dLong / 2 + dLatF / 2 + fzAero * 0.225),
     Math.max(0, sR + dLong / 2 - dLatR / 2 + fzAero * 0.275),
     Math.max(0, sR + dLong / 2 + dLatR / 2 + fzAero * 0.275)
     ];

  let Fbx = 0;
   let Fby = 0;
   let Mz = 0;
   for (let i = 0; i < 4; i++) {
     const px = car.pos[i][0];
     const py = car.pos[i][1];
     const del = i < 2 ? car.steer : 0;
     const cd = Math.cos(del);
     const sd = Math.sin(del);
     const vxw = car.vx - car.r * py;
     const vyw = car.vy + car.r * px;
     const vl = vxw * cd + vyw * sd;
     const vt = -vxw * sd + vyw * cd;
     const tf = tireForce(car, Fz[i], vl, vt, car.omega[i]);
     car.kap[i] = tf.kappa;
     car.alp[i] = Math.atan(tf.tanA);
     car.fz[i] = Fz[i];

   const w = car.omega[i];
     const Tnet = drv[i] - tf.fx * R;
     const den = p.wheelI + dt * tf.dFdw * R;
     let wNew;
     if (brk[i] > 0) {
       const dir = w >= 0 ? 1 : -1;
       wNew = w + dt * (Tnet - dir * brk[i]) / den;
       if ((w >= 0) !== (wNew >= 0)) wNew = 0;
     } else {
       wNew = w + dt * Tnet / den;
     }
     car.omega[i] = car.rev ? Math.min(0, wNew) : Math.max(0, wNew);

   const fxb = tf.fx * cd - tf.fy * sd;
     const fyb = tf.fx * sd + tf.fy * cd;
     Fbx += fxb;
     Fby += fyb;
     Mz += px * fyb - py * fxb;
   }

  // aero drag and rolling resistance
  const speed = Math.hypot(car.vx, car.vy);
   const Fdx = -0.5 * RHO * p.cdA * speed * car.vx - p.crr * p.mass * G * Math.tanh(car.vx / 0.5);
   const Fdy = -0.5 * RHO * p.cdA * 3 * speed * car.vy;
   const axF = (Fbx + Fdx) / p.mass;
   const ayF = (Fby + Fdy) / p.mass;

  const vx0 = car.vx;
   const vy0 = car.vy;
   car.vx += (axF + car.r * vy0) * dt;
   car.vy += (ayF - car.r * vx0) * dt;
   car.r += (Mz / p.iz) * dt;

  const cp = Math.cos(car.psi);
   const sp = Math.sin(car.psi);
   car.x += (car.vx * cp - car.vy * sp) * dt;
   car.y += (car.vx * sp + car.vy * cp) * dt;
   car.psi += car.r * dt;

  const lp = Math.min(1, dt * 25);
   car.ax += (axF - car.ax) * lp;
   car.ay += (ayF - car.ay) * lp;
   car.gLong = axF / G;
   car.gLat = ayF / G;
   car.time += dt;
 }

 root.CarPhysics = { DT: DT, CAR_KAZE: CAR_KAZE, createCar: createCar, resetCar: resetCar, step: step, shift: shift, steerMax: steerMax, clamp: clamp };
})(typeof window !== "undefined" ? window : globalThis);
