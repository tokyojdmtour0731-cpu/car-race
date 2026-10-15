"use strict";
// Car Race prototype (Cycle 2): input, fixed-step loop, closed expressway-style course, lap timer, top-down rendering. Fictional car and course.
(function () {
  const P = window.CarPhysics;
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  const hud = document.getElementById("hud");

 if (location.search.indexOf("test=1") >= 0) {
   window.CarTests.render();
   return;
 }

 // ---- course: closed Catmull-Rom spline through control points, resampled every STEP meters ----
 const WIDTH = 12;
  const STEP = 2;
  const CTRL = [[0, 0], [250, 0], [500, 10], [700, 60], [850, 180], [900, 330], [820, 450], [680, 480], [560, 420], [450, 460], [330, 540], [180, 560], [50, 500], [-60, 380], [-100, 230], [-80, 90]];

 function cr(a, b, c, d, t) {
   const t2 = t * t;
   const t3 = t2 * t;
   return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
 }

 const dense = [];
  for (let i = 0; i < CTRL.length; i++) {
    const p0 = CTRL[(i + CTRL.length - 1) % CTRL.length];
    const p1 = CTRL[i];
    const p2 = CTRL[(i + 1) % CTRL.length];
    const p3 = CTRL[(i + 2) % CTRL.length];
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      dense.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const LEN = cum[dense.length];
  const N = Math.round(LEN / STEP);
  const DS = LEN / N;
  const tx = [];
  const ty = [];
  let seg = 0;
  for (let j = 0; j < N; j++) {
    const target = j * DS;
    while (cum[seg + 1] < target) seg++;
    const a = dense[seg];
    const b = dense[(seg + 1) % dense.length];
    const f = (target - cum[seg]) / (cum[seg + 1] - cum[seg]);
    tx.push(a[0] + (b[0] - a[0]) * f);
    ty.push(a[1] + (b[1] - a[1]) * f);
  }
  const th = [];
  const lx = [];
  const ly = [];
  const rx = [];
  const ry = [];
  let minX = 1e9;
  let maxX = -1e9;
  let minY = 1e9;
  let maxY = -1e9;
  for (let j = 0; j < N; j++) {
    const a = (j + N - 1) % N;
    const b = (j + 1) % N;
    const h = Math.atan2(ty[b] - ty[a], tx[b] - tx[a]);
    th.push(h);
    const nx = -Math.sin(h);
    const ny = Math.cos(h);
    lx.push(tx[j] + nx * WIDTH / 2);
    ly.push(ty[j] + ny * WIDTH / 2);
    rx.push(tx[j] - nx * WIDTH / 2);
    ry.push(ty[j] - ny * WIDTH / 2);
    minX = Math.min(minX, tx[j]);
    maxX = Math.max(maxX, tx[j]);
    minY = Math.min(minY, ty[j]);
    maxY = Math.max(maxY, ty[j]);
  }
  const trk = { i: 0, d: 0 };
  function locate(x, y) {
    let best = 1e18;
    let bi = trk.i;
    for (let o = -15; o <= 15; o++) {
      const j = (trk.i + o + N) % N;
      const dx = x - tx[j];
      const dy = y - ty[j];
      const q = dx * dx + dy * dy;
      if (q < best) { best = q; bi = j; }
    }
    trk.i = bi;
    trk.d = -(x - tx[bi]) * Math.sin(th[bi]) + (y - ty[bi]) * Math.cos(th[bi]);
  }

 // ---- car, input, lap timer ----
 const car = P.createCar(P.CAR_KAZE);
  car.auto = true;
  car.abs = true;
  car.tc = false;
  const inp = { throttle: 0, brake: 0, steer: 0 };
  const keys = {};
  const marks = [];
  const padPrev = {};
  const lap = { running: false, start: 0, cp: 1, valid: true, last: 0, best: 0, prevI: 0, n: 0, msg: "", msgUntil: 0 };
  let offState = 0;
  try { lap.best = parseFloat(localStorage.getItem("carrace_best_c2")) || 0; } catch (e) { lap.best = 0; }

 function fmt(t) {
   if (!(t > 0)) return "-:--.---";
   const m = Math.floor(t / 60);
   const s = t - m * 60;
   return m + ":" + (s < 10 ? "0" : "") + s.toFixed(3);
 }

 function reset() {
   trk.i = 0;
   P.resetCar(car, tx[0], ty[0], th[0]);
   inp.throttle = 0;
   inp.brake = 0;
   inp.steer = 0;
   marks.length = 0;
   lap.running = false;
   lap.cp = 1;
   lap.valid = true;
   lap.prevI = 0;
   lap.msg = "";
   offState = 0;
 }

 function trackStep() {
   locate(car.x, car.y);
   const i = trk.i;
   const ad = Math.abs(trk.d);
   let drag = 0;
   offState = 0;
   if (ad > WIDTH / 2 + 3) { drag = 4; offState = 2; lap.valid = false; }
   else if (ad > WIDTH / 2) { drag = 0.5; offState = 1; }
   if (drag > 0) {
     const f = 1 - drag * P.DT;
     car.vx *= f;
     car.vy *= f;
   }
   if (!lap.running && car.vx > 0.5) { lap.running = true; lap.start = car.time; }
   if (lap.running) {
     if (lap.cp < 4 && i >= lap.cp * N / 4 && i < lap.cp * N / 4 + N / 8) lap.cp++;
     if (lap.prevI > N * 0.75 && i < N * 0.25 && lap.cp === 4) {
       const t = car.time - lap.start;
       if (lap.valid) {
         lap.last = t;
         lap.n++;
         if (lap.best === 0 || t < lap.best) {
           lap.best = t;
           try { localStorage.setItem("carrace_best_c2", String(t)); } catch (e) { }
         }
         lap.msg = "LAP " + fmt(t);
       } else {
         lap.msg = "INVALID LAP (cut or wall)";
       }
       lap.msgUntil = car.time + 5;
       lap.start = car.time;
       lap.cp = 1;
       lap.valid = true;
     }
   }
   lap.prevI = i;
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

 function strokeEdge(xs, ys, win) {
   ctx.beginPath();
   for (let o = -win; o <= win; o++) {
     const j = (trk.i + o + N) % N;
     if (o === -win) ctx.moveTo(xs[j], ys[j]);
     else ctx.lineTo(xs[j], ys[j]);
   }
   ctx.stroke();
 }

 function drawRoad() {
   const win = 140;
   ctx.beginPath();
   for (let o = -win; o <= win; o++) {
     const j = (trk.i + o + N) % N;
     if (o === -win) ctx.moveTo(lx[j], ly[j]);
     else ctx.lineTo(lx[j], ly[j]);
   }
   for (let o = win; o >= -win; o--) {
     const j = (trk.i + o + N) % N;
     ctx.lineTo(rx[j], ry[j]);
   }
   ctx.closePath();
   ctx.fillStyle = "#2a303c";
   ctx.fill();
   ctx.lineWidth = 0.35;
   ctx.strokeStyle = "#e8ecf4";
   strokeEdge(lx, ly, win);
   strokeEdge(rx, ry, win);
   ctx.lineWidth = 0.15;
   ctx.strokeStyle = "#7a8499";
   ctx.setLineDash([3, 6]);
   strokeEdge(tx, ty, win);
   ctx.setLineDash([]);
   ctx.lineWidth = 1.2;
   ctx.strokeStyle = "#ffffff";
   ctx.beginPath();
   ctx.moveTo(lx[0], ly[0]);
   ctx.lineTo(rx[0], ry[0]);
   ctx.stroke();
 }

 function drawMap(W) {
   const dpr = window.devicePixelRatio || 1;
   const mw = 200 * dpr;
   const mh = 130 * dpr;
   const mx = W - mw - 12 * dpr;
   const my = 12 * dpr;
   const k = Math.min((mw - 16 * dpr) / (maxX - minX), (mh - 16 * dpr) / (maxY - minY));
   const ox = mx + (mw - (maxX - minX) * k) / 2;
   const oy = my + (mh - (maxY - minY) * k) / 2;
   ctx.fillStyle = "rgba(0,0,0,0.45)";
   ctx.fillRect(mx, my, mw, mh);
   ctx.strokeStyle = "#7f8fb0";
   ctx.lineWidth = 2 * dpr;
   ctx.beginPath();
   for (let j = 0; j < N; j += 3) {
     const X = ox + (tx[j] - minX) * k;
     const Y = oy + (maxY - ty[j]) * k;
     if (j === 0) ctx.moveTo(X, Y);
     else ctx.lineTo(X, Y);
   }
   ctx.closePath();
   ctx.stroke();
   ctx.fillStyle = "#ff4d4d";
   ctx.beginPath();
   ctx.arc(ox + (car.x - minX) * k, oy + (maxY - car.y) * k, 3.5 * dpr, 0, Math.PI * 2);
   ctx.fill();
 }

 function render() {
   const W = cv.width;
   const H = cv.height;
   ctx.setTransform(1, 0, 0, 1, 0, 0);
   ctx.fillStyle = "#10151a";
   ctx.fillRect(0, 0, W, H);
   const S = Math.min(W, H) / (36 + Math.max(0, car.vx) * 0.9);
   ctx.translate(W / 2, H * 0.65);
   ctx.scale(S, -S);
   ctx.rotate(Math.PI / 2 - car.psi);
   ctx.translate(-car.x, -car.y);

  drawRoad();

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
   drawMap(W);
   const kmh = Math.max(0, car.vx) * 3.6;
   const bar = function (v) { const n = Math.round(P.clamp(v, 0, 1) * 10); return "#".repeat(n) + "-".repeat(10 - n); };
   const lapNow = lap.running ? car.time - lap.start : 0;
   hud.textContent =
     "SPEED " + kmh.toFixed(0) + " km/h\n" +
     "GEAR " + car.gear + (car.auto ? " (auto)" : " (manual)") + " RPM " + car.rpm.toFixed(0) + "\n" +
     "THR [" + bar(inp.throttle) + "] BRK [" + bar(inp.brake) + "]\n" +
     "STEER " + (car.steer * 57.3).toFixed(1) + " deg\n" +
     "G lat " + car.gLat.toFixed(2) + " long " + car.gLong.toFixed(2) + "\n" +
     "slip FL " + car.kap[0].toFixed(2) + "/" + (car.alp[0] * 57.3).toFixed(1) + " FR " + car.kap[1].toFixed(2) + "/" + (car.alp[1] * 57.3).toFixed(1) + "\n" +
     "slip RL " + car.kap[2].toFixed(2) + "/" + (car.alp[2] * 57.3).toFixed(1) + " RR " + car.kap[3].toFixed(2) + "/" + (car.alp[3] * 57.3).toFixed(1) + "\n" +
     "ABS " + (car.abs ? "ON" : "OFF") + " TC " + (car.tc ? "ON" : "OFF") + "\n" +
     "LAP " + (lap.n + 1) + "  " + fmt(lapNow) + (lap.valid ? "" : "  INVALID") + "\n" +
     "LAST " + fmt(lap.last) + "  BEST " + fmt(lap.best) + "\n" +
     "CP " + (lap.cp - 1) + "/3  POS " + (trk.i * DS).toFixed(0) + "/" + LEN.toFixed(0) + " m  OFFSET " + trk.d.toFixed(1) + " m  " + ["ON ROAD", "GRASS", "WALL"][offState] + "\n" +
     (car.time < lap.msgUntil ? lap.msg : "");
 }

 reset();
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
      trackStep();
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
