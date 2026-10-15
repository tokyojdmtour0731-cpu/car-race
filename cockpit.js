"use strict";
// Car Race (Cycle 5): cockpit and chase view. Pseudo-3D perspective renderer. Draw only; physics untouched.
(function () {
  const CV = { mode: 1 };
  window.CockpitView = CV;
  window.addEventListener("keydown", function (e) {
    if (e.code === "KeyB" && !e.repeat) CV.mode = (CV.mode + 1) % 3;
  });
  const HZ = [22, 30, 48];
  const AHEAD = 150;
  const NEAR = 1;
  let NX = null;
  let NY = null;
  function fog(c, f) {
    const k = Math.min(1, f / 320);
    const q = k * k;
    return "rgb(" + Math.round(c[0] + (HZ[0] - c[0]) * q) + "," + Math.round(c[1] + (HZ[1] - c[1]) * q) + "," + Math.round(c[2] + (HZ[2] - c[2]) * q) + ")";
  }
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  CV.draw = function (ctx, W, H) {
    const T = window.RaceTrack;
    const R = window.RaceState;
    if (!T || !R || CV.mode === 0) return;
    const car = R.car;
    const N = T.N;
    if (!NX) {
      NX = [];
      NY = [];
      for (let j = 0; j < N; j++) {
        NX.push(-Math.sin(T.th[j]));
        NY.push(Math.cos(T.th[j]));
      }
    }
    const chase = CV.mode === 2;
    const cps = Math.cos(car.psi);
    const sps = Math.sin(car.psi);
    const ex = chase ? -6.5 : 0.35;
    const ey = chase ? 0 : -0.36;
    const eh = chase ? 2.2 : 1.15;
    const camx = car.x + cps * ex - sps * ey;
    const camy = car.y + sps * ex + cps * ey;
    const F = W * 0.62;
    const hy = H * (chase ? 0.4 : 0.45) + (car.gLong || 0) * H * 0.012;
    function proj(x, y, z) {
      const dx = x - camx;
      const dy = y - camy;
      let f = dx * cps + dy * sps;
      if (f < 0.2) f = 0.2;
      const l = -dx * sps + dy * cps;
      return [W / 2 - l / f * F, hy + (eh - z) / f * F, f];
    }
    function gp(j, k, s, d, z) {
      const x0 = T.tx[j] + NX[j] * d;
      const y0 = T.ty[j] + NY[j] * d;
      const x1 = T.tx[k] + NX[k] * d;
      const y1 = T.ty[k] + NY[k] * d;
      return proj(x0 + (x1 - x0) * s, y0 + (y1 - y0) * s, z);
    }
    function quad(j, k, s0, s1, da, db, za, zb, c) {
      const a = gp(j, k, s0, da, za);
      const b = gp(j, k, s1, da, za);
      const e = gp(j, k, s1, db, zb);
      const g = gp(j, k, s0, db, zb);
      ctx.fillStyle = fog(c, Math.min(a[2], b[2]));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.lineTo(g[0], g[1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-(car.gLat || 0) * 0.012);
    ctx.translate(-W / 2, -H / 2);
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, "#03050a");
    sky.addColorStop(1, "rgb(22,30,48)");
    ctx.fillStyle = sky;
    ctx.fillRect(-W, -H, W * 3, hy + H);
    ctx.fillStyle = "#0b0e13";
    ctx.fillRect(-W, hy, W * 3, H * 2);
    const back = chase ? 8 : 3;
    const i0 = T.trk.i;
    for (let o = AHEAD; o >= -back; o--) {
      const j = (i0 + o + N) % N;
      const k = (j + 1) % N;
      const fa = (T.tx[j] - camx) * cps + (T.ty[j] - camy) * sps;
      const fb = (T.tx[k] - camx) * cps + (T.ty[k] - camy) * sps;
      let s0 = 0;
      let s1 = 1.05;
      if (fa < NEAR && fb < NEAR) continue;
      if (fa < NEAR) s0 = (NEAR - fa) / (fb - fa);
      else if (fb < NEAR) s1 = (NEAR - fa) / (fb - fa);
      if (j % 4 === 0 && o > 2) {
        for (let sd = -1; sd <= 1; sd += 2) {
          const off = 24 + hash(j * 2 + sd) * 40;
          const bw = 10 + hash(j + 7.3 + sd) * 18;
          const bh = 12 + hash(j + 3.1 + sd * 5) * 70;
          const bp = proj(T.tx[j] + NX[j] * off * sd, T.ty[j] + NY[j] * off * sd, 0);
          const bf = bp[2];
          const sw = bw * F / bf;
          const sh = bh * F / bf;
          ctx.fillStyle = fog([22, 27, 38], bf);
          ctx.fillRect(bp[0] - sw / 2, bp[1] - sh, sw, sh);
          if (sw > 14 && bf < 230) {
            ctx.fillStyle = fog([255, 214, 130], bf * 1.4);
            const cols = Math.min(6, Math.floor(bw / 3.5));
            const rows = Math.min(14, Math.floor(bh / 5));
            const cwd = sw / cols;
            const rht = sh / rows;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                if (hash(j * 131 + r * 17 + c * 3 + sd) > 0.6) ctx.fillRect(bp[0] - sw / 2 + c * cwd + cwd * 0.35, bp[1] - sh + r * rht + rht * 0.35, cwd * 0.3, rht * 0.3);
              }
            }
          }
        }
      }
      const wc = ((j >> 1) & 1) ? [88, 94, 106] : [78, 84, 96];
      quad(j, k, s0, s1, 9, 9, 0, 1.1, wc);
      quad(j, k, s0, s1, -9, -9, 0, 1.1, wc);
      quad(j, k, s0, s1, 9, 9.6, 1.1, 1.1, [120, 126, 138]);
      quad(j, k, s0, s1, -9, -9.6, 1.1, 1.1, [120, 126, 138]);
      quad(j, k, s0, s1, 6, 9, 0, 0, [18, 23, 20]);
      quad(j, k, s0, s1, -9, -6, 0, 0, [18, 23, 20]);
      quad(j, k, s0, s1, -6, 6, 0, 0, ((j >> 2) & 1) ? [46, 52, 64] : [41, 47, 58]);
      quad(j, k, s0, s1, 5.55, 5.8, 0, 0, [225, 228, 236]);
      quad(j, k, s0, s1, -5.8, -5.55, 0, 0, [225, 228, 236]);
      if (((j >> 1) & 1) === 0) quad(j, k, s0, s1, -0.1, 0.1, 0, 0, [205, 208, 216]);
      if (j === 0) quad(j, k, s0, s1, -6, 6, 0, 0, [240, 240, 245]);
      if (j % 20 === 0 || j % 20 === 10) {
        const sd = j % 20 === 0 ? 1 : -1;
        const px = T.tx[j] + NX[j] * 9.5 * sd;
        const py = T.ty[j] + NY[j] * 9.5 * sd;
        const b0 = proj(px, py, 0);
        const b1 = proj(px, py, 9);
        if (b0[2] > 2) {
          ctx.strokeStyle = fog([70, 74, 84], b0[2]);
          ctx.lineWidth = Math.max(1, 0.3 * F / b0[2]);
          ctx.beginPath();
          ctx.moveTo(b0[0], b0[1]);
          ctx.lineTo(b1[0], b1[1]);
          ctx.stroke();
          const lp = proj(T.tx[j] + NX[j] * 7.5 * sd, T.ty[j] + NY[j] * 7.5 * sd, 9);
          ctx.fillStyle = fog([255, 196, 110], lp[2] * 0.4);
          ctx.beginPath();
          ctx.arc(lp[0], lp[1], Math.max(1.5, 0.6 * F / lp[2]), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const gpz = window.GhostPos;
    if (gpz && (gpz.x - camx) * cps + (gpz.y - camy) * sps > 2) {
      const gcs = Math.cos(gpz.psi);
      const gsn = Math.sin(gpz.psi);
      const gw = function (x, y, z) { return proj(gpz.x + gcs * x - gsn * y, gpz.y + gsn * x + gcs * y, z); };
      const gq = function (a, c) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(a[0][0], a[0][1]);
        for (let q = 1; q < a.length; q++) ctx.lineTo(a[q][0], a[q][1]);
        ctx.closePath();
        ctx.fill();
      };
      const gxr = -car.b - 0.9;
      const gxf = car.a + 0.85;
      ctx.globalAlpha = 0.7;
      gq([gw(gxr, 0.9, 0.25), gw(gxf, 0.9, 0.25), gw(gxf, 0.9, 0.95), gw(gxr, 0.9, 0.95)], "#d9b300");
      gq([gw(gxr, -0.9, 0.25), gw(gxf, -0.9, 0.25), gw(gxf, -0.9, 0.95), gw(gxr, -0.9, 0.95)], "#d9b300");
      gq([gw(gxr, 0.9, 0.95), gw(gxf, 0.9, 0.95), gw(gxf, -0.9, 0.95), gw(gxr, -0.9, 0.95)], "#ffd23f");
      gq([gw(gxr + 1.0, 0.75, 1.35), gw(gxr + 2.9, 0.75, 1.35), gw(gxr + 2.9, -0.75, 1.35), gw(gxr + 1.0, -0.75, 1.35)], "#ffe27a");
      gq([gw(gxr, 0.9, 0.25), gw(gxr, -0.9, 0.25), gw(gxr, -0.9, 0.95), gw(gxr, 0.9, 0.95)], "#c9a000");
      ctx.globalAlpha = 1;
    }
    if (chase) {
      const cw = function (x, y, z) { return proj(car.x + cps * x - sps * y, car.y + sps * x + cps * y, z); };
      const poly = function (a, c) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(a[0][0], a[0][1]);
        for (let q = 1; q < a.length; q++) ctx.lineTo(a[q][0], a[q][1]);
        ctx.closePath();
        ctx.fill();
      };
      const xr = -car.b - 0.9;
      const xf = car.a + 0.85;
      poly([cw(xr, 0.9, 0.25), cw(xf, 0.9, 0.25), cw(xf, 0.9, 0.95), cw(xr, 0.9, 0.95)], "#6c7c9c");
      poly([cw(xr, -0.9, 0.25), cw(xf, -0.9, 0.25), cw(xf, -0.9, 0.95), cw(xr, -0.9, 0.95)], "#6c7c9c");
      poly([cw(xr, 0.9, 0.95), cw(xf, 0.9, 0.95), cw(xf, -0.9, 0.95), cw(xr, -0.9, 0.95)], "#8fa0c0");
      poly([cw(xr + 0.9, 0.8, 0.95), cw(xr + 0.9, -0.8, 0.95), cw(xr + 1.0, -0.75, 1.35), cw(xr + 1.0, 0.75, 1.35)], "#232a3a");
      poly([cw(xr + 1.0, 0.75, 1.35), cw(xr + 2.9, 0.75, 1.35), cw(xr + 2.9, -0.75, 1.35), cw(xr + 1.0, -0.75, 1.35)], "#5d6d8c");
      poly([cw(xr, 0.9, 0.25), cw(xr, -0.9, 0.25), cw(xr, -0.9, 0.95), cw(xr, 0.9, 0.95)], "#586784");
      poly([cw(xr, 0.85, 0.7), cw(xr, 0.4, 0.7), cw(xr, 0.4, 0.85), cw(xr, 0.85, 0.85)], "#ff2a2a");
      poly([cw(xr, -0.85, 0.7), cw(xr, -0.4, 0.7), cw(xr, -0.4, 0.85), cw(xr, -0.85, 0.85)], "#ff2a2a");
    }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!chase) interior(ctx, W, H, car);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = Math.round(H * 0.018) + "px monospace";
    ctx.textAlign = "right";
    ctx.fillText("B: VIEW (" + ["TOP", "COCKPIT", "CHASE"][CV.mode] + ")", W - 12, H * 0.9);
    ctx.textAlign = "left";
  };
  function dial(ctx, cx, cy, r, v, vmax, red) {
    ctx.fillStyle = "#05070a";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8b93a5";
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    for (let t = 0; t <= 10; t++) {
      const a = a0 + (a1 - a0) * t / 10;
      ctx.strokeStyle = t / 10 >= red ? "#ff4d4d" : "#e8ecf4";
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
      ctx.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
      ctx.stroke();
    }
    const an = a0 + (a1 - a0) * Math.max(0, Math.min(1, v / vmax));
    ctx.strokeStyle = "#ff6a2a";
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(an) * r * 0.82, cy + Math.sin(an) * r * 0.82);
    ctx.stroke();
    ctx.fillStyle = "#ff6a2a";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  function interior(ctx, W, H, car) {
    ctx.fillStyle = "#090b0f";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H * 0.07);
    ctx.quadraticCurveTo(W / 2, H * 0.11, 0, H * 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.1, H * 0.08);
    ctx.lineTo(W * 0.03, H * 0.82);
    ctx.lineTo(0, H * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W * 0.89, H * 0.08);
    ctx.lineTo(W * 0.95, H * 0.82);
    ctx.lineTo(W, H * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#141a28";
    ctx.strokeStyle = "#2a2f3a";
    ctx.lineWidth = 2;
    ctx.fillRect(W * 0.42, H * 0.09, W * 0.16, H * 0.06);
    ctx.strokeRect(W * 0.42, H * 0.09, W * 0.16, H * 0.06);
    ctx.fillStyle = "#090b0f";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.84);
    ctx.quadraticCurveTo(W * 0.5, H * 0.77, W, H * 0.84);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    const r = H * 0.07;
    const cx = W / 2;
    const cy = H * 0.885;
    const kmh = Math.max(0, car.vx) * 3.6;
    dial(ctx, cx - r * 1.25, cy, r, car.rpm, 10000, 0.75);
    dial(ctx, cx + r * 1.25, cy, r, kmh, 300, 2);
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold " + Math.round(r * 0.6) + "px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(car.gear), cx, cy + r * 0.2);
    ctx.fillStyle = "#ffffff";
    ctx.font = Math.round(r * 0.35) + "px monospace";
    ctx.fillText(kmh.toFixed(0), cx + r * 1.25, cy + r * 0.5);
    ctx.textAlign = "left";
    const wa = Math.max(-4, Math.min(4, car.steer * 12));
    ctx.save();
    ctx.translate(W / 2, H * 1.1);
    ctx.rotate(-wa);
    const Rw = H * 0.31;
    ctx.strokeStyle = "#2a2f3a";
    ctx.lineWidth = H * 0.045;
    ctx.beginPath();
    ctx.arc(0, 0, Rw, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#454d60";
    ctx.lineWidth = H * 0.006;
    ctx.beginPath();
    ctx.arc(0, 0, Rw + H * 0.012, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#e8e8ee";
    ctx.lineWidth = H * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, -Rw - H * 0.02);
    ctx.lineTo(0, -Rw + H * 0.02);
    ctx.stroke();
    ctx.strokeStyle = "#2a2f3a";
    ctx.lineWidth = H * 0.04;
    ctx.beginPath();
    ctx.moveTo(-Rw, 0);
    ctx.lineTo(Rw, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, Rw);
    ctx.stroke();
    ctx.restore();
  }
})();
