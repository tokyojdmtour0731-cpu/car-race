"use strict";
// Car Race prototype: input, fixed-step loop and top-down rendering. Fictional car.
(function () {
  const P = window.CarPhysics;
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  const hud = document.getElementById("hud");

 if (location.search.indexOf("test=1") >= 0) {
   window.CarTests.render();
   return;
 }

 const car = P.createCar(P.CAR_KAZE);
  car.auto = true;
  car.abs = true;
  car.tc = false;
  const inp = { throttle: 0, brake: 0, steer: 0 };
  const keys = {};
  const marks = [];
  const padPrev = {};
  let lap0 = 0;

 function reset() {
   P.resetCar(car, 0, 0, 0);
   inp.throttle = 0;
   inp.brake = 0;
   inp.steer = 0;
   marks.length = 0;
 }

 window.addEventListener("keydown", function (e) {
   keys[e.code] = true;
   if (!e.repeat) onPress(e.code);
   if (e.code.indexOf("Arrow") === 0 || e.code === "Space") e.preventDefault();
 });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });

 function onPress(code) {
   if (code === "KeyE") P.shift(car, 1);
   if (code === "KeyQ") P.shift(car, -1);
   if (code === "KeyM") car.auto = !car.auto;
   if (code === "Digit1") car.abs = !car.abs;
   if (code === "Digit2") car.tc = !car.tc;
   if (code === "KeyR") reset();
 }

 function approach(v, target, rate, dt) {
   const d = target - v;
   const m = rate * dt;
   return Math.abs(d) <= m ? target : v + Math.sign(d) * m;
 }

 function readInput(dt) {
   const kThr = (keys.KeyW || keys.ArrowUp) ? 1 : 0;
   const kBrk = (keys.KeyS || keys.ArrowDown) ? 1 : 0;
   const kSt = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
   inp.throttle = approach(inp.throttle, kThr, kThr ? 4 : 8, dt);
   inp.brake = approach(inp.brake, kBrk, kBrk ? 5 : 10, dt);
   const sr = 2.5 / (1 + Math.max(0, car.vx) / 20);
   inp.steer = approach(inp.steer, kSt, kSt !== 0 ? sr : 5, dt);

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
   for (let n = 0; n < pads.length; n++) {
     const gp = pads[n];
     if (!gp) continue;
     const ax = gp.axes[0] || 0;
     const st = Math.abs(ax) < 0.06 ? 0 : ax;
     const t = gp.buttons[7] ? gp.buttons[7].value : 0;
     const b = gp.buttons[6] ? gp.buttons[6].value : 0;
     if (st !== 0 || t > 0.02 || b > 0.02) {
       inp.steer = -st;
       inp.throttle = t;
       inp.brake = b;
     }
     const up = gp.buttons[5] && gp.buttons[5].pressed;
     const dn = gp.buttons[4] && gp.buttons[4].pressed;
     if (up && !padPrev.up) P.shift(car, 1);
     if (dn && !padPrev.dn) P.shift(car, -1);
     padPrev.up = up;
     padPrev.dn = dn;
   }
 }

 function addMarks() {
   for (let i = 2; i < 4; i++) {
     const slip = Math.hypot(car.kap[i] / 0.12, Math.tan(car.alp[i]) / 0.17);
     if (slip > 1.6 && car.vx > 2) {
       const px = car.pos[i][0];
       const py = car.pos[i][1];
       const c = Math.cos(car.psi);
       const s = Math.sin(car.psi);
       marks.push(car.x + c * px - s * py, car.y + s * px + c * py);
       if (marks.length > 8000) marks.splice(0, 2);
     }
   }
 }

 function resize() {
   const dpr = window.devicePixelRatio || 1;
   cv.width = Math.floor(window.innerWidth * dpr);
   cv.height = Math.floor(window.innerHeight * dpr);
 }
  window.addEventListener("resize", resize);
  resize();

 function slipColor(i) {
   const s = Math.hypot(car.kap[i] / 0.12, Math.tan(car.alp[i]) / 0.17);
   if (s < 1) return "#3ddc84";
   if (s < 2) return "#ffd23f";
   return "#ff4d4d";
 }

 function render() {
   const W = cv.width;
   const H = cv.height;
   ctx.setTransform(1, 0, 0, 1, 0, 0);
   ctx.fillStyle = "#14171f";
   ctx.fillRect(0, 0, W, H);
   const S = Math.min(W, H) / (36 + Math.max(0, car.vx) * 0.9);
   ctx.translate(W / 2, H * 0.65);
   ctx.scale(S, -S);
   ctx.rotate(Math.PI / 2 - car.psi);
   ctx.translate(-car.x, -car.y);

  const reach = Math.max(W, H) / S;
   const g0 = 10;
   const gx0 = Math.floor((car.x - reach) / g0) * g0;
   const gx1 = car.x + reach;
   const gy0 = Math.floor((car.y - reach) / g0) * g0;
   const gy1 = car.y + reach;
   ctx.lineWidth = 0.08;
   ctx.strokeStyle = "#232834";
   ctx.beginPath();
   for (let x = gx0; x < gx1; x += g0) { ctx.moveTo(x, gy0); ctx.lineTo(x, gy1); }
   for (let y = gy0; y < gy1; y += g0) { ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); }
   ctx.stroke();

  // reference layout: 50 m radius circle (center 0,50) and distance lines along +x
  ctx.strokeStyle = "#3a4a66";
   ctx.lineWidth = 0.4;
   ctx.beginPath();
   ctx.arc(0, 50, 50, 0, Math.PI * 2);
   ctx.stroke();
   ctx.strokeStyle = "#5c4a2e";
   for (let d = 100; d <= 2000; d += 100) {
     ctx.beginPath();
     ctx.moveTo(d, -8);
     ctx.lineTo(d, 8);
     ctx.stroke();
   }

  ctx.fillStyle = "rgba(0,0,0,0.55)";
   for (let i = 0; i < marks.length; i += 2) ctx.fillRect(marks[i] - 0.1, marks[i + 1] - 0.1, 0.2, 0.2);

  ctx.save();
   ctx.translate(car.x, car.y);
   ctx.rotate(car.psi);
   ctx.fillStyle = "#c8d2e6";
   ctx.fillRect(-car.b - 0.9, -0.9, car.a + car.b + 1.75, 1.8);
   ctx.fillStyle = "#6a7a99";
   ctx.fillRect(-0.9, -0.7, 1.7, 1.4);
   for (let i = 0; i < 4; i++) {
     ctx.save();
     ctx.translate(car.pos[i][0], car.pos[i][1]);
     if (i < 2) ctx.rotate(car.steer);
     ctx.fillStyle = slipColor(i);
     ctx.fillRect(-0.32, -0.13, 0.64, 0.26);
     ctx.restore();
   }
   ctx.restore();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
   const kmh = Math.max(0, car.vx) * 3.6;
   const bar = function (v) { const n = Math.round(P.clamp(v, 0, 1) * 10); return "#".repeat(n) + "-".repeat(10 - n); };
   hud.textContent =
     "SPEED  " + kmh.toFixed(0) + " km/h\n" +
     "GEAR   " + car.gear + (car.auto ? " (auto)" : " (manual)") + "   RPM " + car.rpm.toFixed(0) + "\n" +
     "THR [" + bar(inp.throttle) + "]  BRK [" + bar(inp.brake) + "]\n" +
     "STEER  " + (car.steer * 57.3).toFixed(1) + " deg\n" +
     "G lat " + car.gLat.toFixed(2) + "  long " + car.gLong.toFixed(2) + "\n" +
     "slip FL " + car.kap[0].toFixed(2) + "/" + (car.alp[0] * 57.3).toFixed(1) + "  FR " + car.kap[1].toFixed(2) + "/" + (car.alp[1] * 57.3).toFixed(1) + "\n" +
     "slip RL " + car.kap[2].toFixed(2) + "/" + (car.alp[2] * 57.3).toFixed(1) + "  RR " + car.kap[3].toFixed(2) + "/" + (car.alp[3] * 57.3).toFixed(1) + "\n" +
     "ABS " + (car.abs ? "ON" : "OFF") + "  TC " + (car.tc ? "ON" : "OFF") + "\n" +
     "TIME   " + car.time.toFixed(1) + " s   DIST " + car.x.toFixed(0) + " m";
 }

 let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    readInput(dt);
    let n = 0;
    while (acc >= P.DT && n < 20) {
      P.step(car, inp, P.DT);
      addMarks();
      acc -= P.DT;
      n++;
    }
    if (n >= 20) acc = 0;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
