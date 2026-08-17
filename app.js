(() => {
  "use strict";

  const canvas = document.getElementById("latheCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const rpmSlider = document.getElementById("rpmSlider");
  const rpmReadout = document.getElementById("rpmReadout");
  const positionReadout = document.getElementById("positionReadout");
  const diameterReadout = document.getElementById("diameterReadout");
  const resetBtn = document.getElementById("resetBtn");

  const MODEL = {
    lengthIn: 18,
    blankDiameterIn: 4,
    sampleCount: 320,
    radii: [],
    rpm: Number(rpmSlider.value),
    rotation: 0,
    chiselX: 0.5,
    chiselDepth: 0,
    dragging: false,
    lastTime: performance.now()
  };

  const CHISEL = {
    widthIn: 0.42,
    maxDepthIn: 1.75,
    cutRate: 5.25
  };

  function resetBlank() {
    MODEL.radii = new Array(MODEL.sampleCount).fill(MODEL.blankDiameterIn / 2);
    MODEL.chiselX = 0.5;
    MODEL.chiselDepth = 0;
    updateReadout();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function stageGeometry() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const left = w * 0.09;
    const right = w * 0.91;
    const cx = (left + right) / 2;
    const cy = h * 0.48;
    const maxRadiusPx = Math.min(h * 0.25, (right - left) * 0.13);

    return { w, h, left, right, cx, cy, maxRadiusPx, lengthPx: right - left };
  }

  function radiusAtNormalizedX(t) {
    const idx = Math.max(0, Math.min(MODEL.sampleCount - 1, Math.round(t * (MODEL.sampleCount - 1))));
    return MODEL.radii[idx];
  }

  function applyCut(dt) {
    if (!MODEL.dragging || MODEL.chiselDepth <= 0) return;

    const centerIndex = MODEL.chiselX * (MODEL.sampleCount - 1);
    const samplesPerIn = (MODEL.sampleCount - 1) / MODEL.lengthIn;
    const halfWidthSamples = Math.max(1, (CHISEL.widthIn * samplesPerIn) / 2);

    const desiredRadius = Math.max(
      0.12,
      MODEL.blankDiameterIn / 2 - MODEL.chiselDepth
    );

    const removalScale = CHISEL.cutRate * dt * (0.5 + MODEL.rpm / 1800);

    const start = Math.max(0, Math.floor(centerIndex - halfWidthSamples * 1.6));
    const end = Math.min(MODEL.sampleCount - 1, Math.ceil(centerIndex + halfWidthSamples * 1.6));

    for (let i = start; i <= end; i++) {
      const d = Math.abs(i - centerIndex) / halfWidthSamples;

      // Rounded gouge-like contact profile.
      let influence = 0;
      if (d <= 1) {
        influence = Math.sqrt(Math.max(0, 1 - d * d));
      } else if (d < 1.6) {
        influence = (1.6 - d) / 0.6 * 0.12;
      }

      if (influence <= 0) continue;

      const target = MODEL.blankDiameterIn / 2 -
        (MODEL.blankDiameterIn / 2 - desiredRadius) * influence;

      if (MODEL.radii[i] > target) {
        const maxRemove = removalScale * influence;
        MODEL.radii[i] = Math.max(target, MODEL.radii[i] - maxRemove);
      }
    }
  }

  function drawLathe() {
    const g = stageGeometry();
    const scale = g.maxRadiusPx / (MODEL.blankDiameterIn / 2);

    ctx.fillStyle = "#1b1714";
    ctx.fillRect(0, 0, g.w, g.h);

    const glow = ctx.createRadialGradient(g.cx, g.cy - 30, 20, g.cx, g.cy, g.w * 0.7);
    glow.addColorStop(0, "#44372c");
    glow.addColorStop(1, "#171411");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.w, g.h);

    // Bed
    ctx.fillStyle = "#30343a";
    ctx.fillRect(g.left - 22, g.cy + g.maxRadiusPx + 34, g.lengthPx + 44, 15);

    // Headstock / tailstock
    ctx.fillStyle = "#3b4148";
    roundRect(ctx, g.left - 38, g.cy - 62, 32, 124, 7, true);
    roundRect(ctx, g.right + 6, g.cy - 62, 32, 124, 7, true);

    // Wood body silhouette
    ctx.beginPath();
    for (let i = 0; i < MODEL.sampleCount; i++) {
      const t = i / (MODEL.sampleCount - 1);
      const x = g.left + t * g.lengthPx;
      const y = g.cy - MODEL.radii[i] * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = MODEL.sampleCount - 1; i >= 0; i--) {
      const t = i / (MODEL.sampleCount - 1);
      const x = g.left + t * g.lengthPx;
      const y = g.cy + MODEL.radii[i] * scale;
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    const woodGrad = ctx.createLinearGradient(0, g.cy - g.maxRadiusPx, 0, g.cy + g.maxRadiusPx);
    woodGrad.addColorStop(0, "#d7994f");
    woodGrad.addColorStop(.35, "#a8642e");
    woodGrad.addColorStop(.55, "#e0a25d");
    woodGrad.addColorStop(.78, "#9c5728");
    woodGrad.addColorStop(1, "#6e3b1f");
    ctx.fillStyle = woodGrad;
    ctx.fill();

    // Animated grain / rotation cue
    ctx.save();
    ctx.clip();
    const stripeSpacing = 18;
    const offset = (MODEL.rotation * 22) % stripeSpacing;
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#4e2817";
    ctx.lineWidth = 2;
    for (let x = g.left - stripeSpacing + offset; x < g.right + stripeSpacing; x += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, g.cy - g.maxRadiusPx * 1.3);
      ctx.bezierCurveTo(
        x + 6, g.cy - 20,
        x - 7, g.cy + 22,
        x + 4, g.cy + g.maxRadiusPx * 1.3
      );
      ctx.stroke();
    }
    ctx.restore();

    // Center line
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(g.left - 10, g.cy);
    ctx.lineTo(g.right + 10, g.cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    drawChisel(g, scale);
  }

  function drawChisel(g, scale) {
    const x = g.left + MODEL.chiselX * g.lengthPx;
    const surfaceRadius = radiusAtNormalizedX(MODEL.chiselX);
    const topSurfaceY = g.cy - surfaceRadius * scale;

    const toolY = Math.min(
      g.cy + g.maxRadiusPx + 92,
      topSurfaceY + MODEL.chiselDepth * scale
    );

    // Tool rest
    ctx.fillStyle = "#646b72";
    roundRect(ctx, x - 42, g.cy + g.maxRadiusPx + 18, 84, 7, 3, true);

    // Chisel shaft
    ctx.save();
    ctx.translate(x, toolY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#7d848b";
    roundRect(ctx, -4, -7, 88, 14, 4, true);
    ctx.fillStyle = "#70411f";
    roundRect(ctx, 70, -12, 72, 24, 8, true);
    ctx.restore();

    // Tip/contact marker
    ctx.fillStyle = MODEL.dragging ? "#fff" : "#d5d7da";
    ctx.beginPath();
    ctx.moveTo(x - 9, toolY + 2);
    ctx.lineTo(x + 9, toolY + 2);
    ctx.lineTo(x, toolY - 9);
    ctx.closePath();
    ctx.fill();

    if (MODEL.dragging) {
      ctx.globalAlpha = .55;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, toolY - 4, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  function pointerToModel(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const g = stageGeometry();

    MODEL.chiselX = Math.max(0, Math.min(1, (x - g.left) / g.lengthPx));

    const surfaceRadius = radiusAtNormalizedX(MODEL.chiselX);
    const scale = g.maxRadiusPx / (MODEL.blankDiameterIn / 2);
    const surfaceY = g.cy - surfaceRadius * scale;

    MODEL.chiselDepth = Math.max(
      0,
      Math.min(CHISEL.maxDepthIn, (y - surfaceY) / scale)
    );

    updateReadout();
  }

  function updateReadout() {
    MODEL.rpm = Number(rpmSlider.value);
    rpmReadout.textContent = String(MODEL.rpm);

    const posIn = MODEL.chiselX * MODEL.lengthIn;
    positionReadout.textContent = `${posIn.toFixed(1)} in`;

    const dia = radiusAtNormalizedX(MODEL.chiselX) * 2;
    diameterReadout.textContent = `${dia.toFixed(2)} in`;
  }

  canvas.addEventListener("pointerdown", e => {
    MODEL.dragging = true;
    canvas.setPointerCapture(e.pointerId);
    pointerToModel(e.clientX, e.clientY);
  });

  canvas.addEventListener("pointermove", e => {
    if (!MODEL.dragging) return;
    pointerToModel(e.clientX, e.clientY);
  });

  function endPointer(e) {
    MODEL.dragging = false;
    MODEL.chiselDepth = 0;
    if (e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    updateReadout();
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  rpmSlider.addEventListener("input", updateReadout);
  resetBtn.addEventListener("click", resetBlank);
  window.addEventListener("resize", resizeCanvas);

  function frame(now) {
    const dt = Math.min(0.033, (now - MODEL.lastTime) / 1000);
    MODEL.lastTime = now;

    MODEL.rpm = Number(rpmSlider.value);
    MODEL.rotation += (MODEL.rpm / 60) * Math.PI * 2 * dt;

    applyCut(dt);
    updateReadout();
    drawLathe();
    requestAnimationFrame(frame);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  resetBlank();
  resizeCanvas();
  requestAnimationFrame(frame);
})();
