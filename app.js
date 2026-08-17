(() => {
  "use strict";

  const canvas = document.getElementById("latheCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const resetBtn = document.getElementById("resetBtn");
  const rpmKnob = document.getElementById("rpmKnob");
  const knobPointer = document.getElementById("knobPointer");
  const rpmReadout = document.getElementById("rpmReadout");
  const positionReadout = document.getElementById("positionReadout");
  const diameterReadout = document.getElementById("diameterReadout");

  const MODEL = {
    lengthIn: 18,
    blankDiameterIn: 4,
    sampleCount: 320,
    radii: [],
    rpm: 900,
    rotation: 0,
    chiselX: 0.5,
    chiselDepth: 0,
    dragging: false,
    pointerId: null,
    handleX: 0,
    handleY: 0,
    grabOffsetX: 0,
    grabOffsetY: 0,
    lastTime: performance.now()
  };

  const CHISEL = {
    widthIn: 0.42,
    maxDepthIn: 1.75,
    cutRate: 5.25
  };

  const KNOB = {
    min: 200,
    max: 3200,
    startDeg: -135,
    sweepDeg: 270,
    dragging: false,
    pointerId: null
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function resetBlank() {
    MODEL.radii = new Array(MODEL.sampleCount).fill(MODEL.blankDiameterIn / 2);
    MODEL.chiselX = 0.5;
    MODEL.chiselDepth = 0;
    MODEL.dragging = false;
    MODEL.pointerId = null;
    centerHandle();
    updateReadout();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!MODEL.dragging) centerHandle();
  }

  function stageGeometry() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const left = w * 0.13;
    const right = w * 0.87;
    const cx = (left + right) / 2;
    const cy = h * 0.34;
    const maxRadiusPx = Math.min(h * 0.145, (right - left) * 0.15);
    const toolRestY = cy + maxRadiusPx + Math.max(34, h * 0.055);
    const handleHomeY = Math.min(h - 70, toolRestY + Math.max(145, h * 0.29));
    return {
      w, h, left, right, cx, cy, maxRadiusPx,
      lengthPx: right - left, toolRestY, handleHomeY
    };
  }

  function centerHandle() {
    const g = stageGeometry();
    MODEL.handleX = g.cx;
    MODEL.handleY = g.handleHomeY;
  }

  function radiusAtNormalizedX(t) {
    const idx = clamp(Math.round(t * (MODEL.sampleCount - 1)), 0, MODEL.sampleCount - 1);
    return MODEL.radii[idx];
  }

  function toolPose() {
    const g = stageGeometry();
    const hx = clamp(MODEL.handleX || g.cx, g.left - 22, g.right + 22);
    const minHandleY = g.toolRestY + 88;
    const hy = clamp(MODEL.handleY || g.handleHomeY, minHandleY, g.h - 48);

    const chiselX = clamp((hx - g.left) / g.lengthPx, 0, 1);
    const radius = radiusAtNormalizedX(chiselX);
    const scale = g.maxRadiusPx / (MODEL.blankDiameterIn / 2);
    const woodBottomY = g.cy + radius * scale;

    const feed = clamp(
      (g.handleHomeY - hy) / Math.max(1, g.handleHomeY - minHandleY),
      0, 1
    );

    const freeTipY = woodBottomY + 22;
    const maxTipY = woodBottomY - CHISEL.maxDepthIn * scale;
    const tipY = freeTipY + (maxTipY - freeTipY) * feed;
    const tipX = g.left + chiselX * g.lengthPx;
    const depthIn = clamp(Math.max(0, woodBottomY - tipY) / scale, 0, CHISEL.maxDepthIn);

    return { g, handleX:hx, handleY:hy, tipX, tipY, chiselX, depthIn, scale, woodBottomY };
  }

  function applyCut(dt) {
    if (!MODEL.dragging || MODEL.chiselDepth <= 0) return;

    const centerIndex = MODEL.chiselX * (MODEL.sampleCount - 1);
    const samplesPerIn = (MODEL.sampleCount - 1) / MODEL.lengthIn;
    const halfWidth = Math.max(1, (CHISEL.widthIn * samplesPerIn) / 2);

    const desiredRadius = Math.max(
      0.12,
      MODEL.blankDiameterIn / 2 - MODEL.chiselDepth
    );

    const removalScale = CHISEL.cutRate * dt * (0.5 + MODEL.rpm / 1800);
    const start = Math.max(0, Math.floor(centerIndex - halfWidth * 1.6));
    const end = Math.min(MODEL.sampleCount - 1, Math.ceil(centerIndex + halfWidth * 1.6));

    for (let i = start; i <= end; i++) {
      const d = Math.abs(i - centerIndex) / halfWidth;
      let influence = 0;

      if (d <= 1) influence = Math.sqrt(Math.max(0, 1 - d * d));
      else if (d < 1.6) influence = (1.6 - d) / 0.6 * 0.12;

      if (influence <= 0) continue;

      const target =
        MODEL.blankDiameterIn / 2 -
        (MODEL.blankDiameterIn / 2 - desiredRadius) * influence;

      if (MODEL.radii[i] > target) {
        MODEL.radii[i] = Math.max(
          target,
          MODEL.radii[i] - removalScale * influence
        );
      }
    }
  }

  function roundRect(x, y, w, h, r, fillStyle, strokeStyle) {
    const rr = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.stroke(); }
  }

  function drawMachine(g) {
    // workshop background
    const bg = ctx.createLinearGradient(0, 0, 0, g.h);
    bg.addColorStop(0, "#37322d");
    bg.addColorStop(.48, "#211e1b");
    bg.addColorStop(1, "#121314");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,g.w,g.h);

    // back wall highlight
    const glow = ctx.createRadialGradient(g.cx,g.cy-30,20,g.cx,g.cy,g.w*.65);
    glow.addColorStop(0,"rgba(205,176,136,.13)");
    glow.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=glow; ctx.fillRect(0,0,g.w,g.h);

    // base casting
    roundRect(g.left-66, g.cy+g.maxRadiusPx+48, g.lengthPx+132, 57, 11, "#202427");
    roundRect(g.left-49, g.cy+g.maxRadiusPx+54, g.lengthPx+98, 12, 5, "#555b5f");
    roundRect(g.left-49, g.cy+g.maxRadiusPx+74, g.lengthPx+98, 11, 5, "#3d4246");

    // headstock body
    const hsX=g.left-69, hsY=g.cy-g.maxRadiusPx-50;
    const hsGrad=ctx.createLinearGradient(hsX,hsY,hsX+63,hsY);
    hsGrad.addColorStop(0,"#15181a"); hsGrad.addColorStop(.45,"#464b4e"); hsGrad.addColorStop(1,"#25292c");
    roundRect(hsX,hsY,62,g.maxRadiusPx*2+100,12,hsGrad,"#62676a");

    // headstock cap / motor bump
    roundRect(hsX+7,hsY-18,48,30,10,"#2a2e31","#5a6064");
    ctx.fillStyle="#0d0f10";
    ctx.beginPath(); ctx.arc(hsX+31,hsY+35,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#777d81";
    ctx.beginPath(); ctx.arc(hsX+31,hsY+35,5,0,Math.PI*2); ctx.fill();

    // tailstock
    const tsX=g.right+8, tsY=g.cy-g.maxRadiusPx-33;
    const tsGrad=ctx.createLinearGradient(tsX,tsY,tsX+55,tsY);
    tsGrad.addColorStop(0,"#373c3f"); tsGrad.addColorStop(.55,"#181b1d"); tsGrad.addColorStop(1,"#505558");
    roundRect(tsX,tsY,53,g.maxRadiusPx*2+68,10,tsGrad,"#62676a");
    roundRect(tsX+31,g.cy-13,44,26,7,"#303538","#646a6e");
    ctx.strokeStyle="#777c80"; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(tsX+53,g.cy); ctx.lineTo(tsX+77,g.cy); ctx.stroke();

    // spindle + chuck
    const chuckX=g.left-5;
    ctx.fillStyle="#1a1d1f";
    ctx.fillRect(chuckX-22,g.cy-22,22,44);
    ctx.fillStyle="#62686b";
    ctx.beginPath(); ctx.arc(chuckX-11,g.cy,20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#24282a";
    ctx.beginPath(); ctx.arc(chuckX-11,g.cy,13,0,Math.PI*2); ctx.fill();

    // live center
    ctx.fillStyle="#8b9194";
    ctx.beginPath();
    ctx.moveTo(g.right+7,g.cy-8);
    ctx.lineTo(g.right-11,g.cy);
    ctx.lineTo(g.right+7,g.cy+8);
    ctx.closePath();ctx.fill();

    // feet
    roundRect(g.left-55,g.cy+g.maxRadiusPx+101,42,17,4,"#111315");
    roundRect(g.right+14,g.cy+g.maxRadiusPx+101,42,17,4,"#111315");
  }

  function drawWood(g) {
    const scale = g.maxRadiusPx / (MODEL.blankDiameterIn / 2);

    ctx.save();
    ctx.beginPath();
    for (let i=0;i<MODEL.sampleCount;i++) {
      const t=i/(MODEL.sampleCount-1);
      const x=g.left+t*g.lengthPx;
      const y=g.cy-MODEL.radii[i]*scale;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    for(let i=MODEL.sampleCount-1;i>=0;i--){
      const t=i/(MODEL.sampleCount-1);
      const x=g.left+t*g.lengthPx;
      const y=g.cy+MODEL.radii[i]*scale;
      ctx.lineTo(x,y);
    }
    ctx.closePath();

    const woodGrad=ctx.createLinearGradient(0,g.cy-g.maxRadiusPx,0,g.cy+g.maxRadiusPx);
    woodGrad.addColorStop(0,"#6d3b1d");
    woodGrad.addColorStop(.16,"#a96734");
    woodGrad.addColorStop(.42,"#d49a58");
    woodGrad.addColorStop(.55,"#bb753a");
    woodGrad.addColorStop(.73,"#8a4c26");
    woodGrad.addColorStop(1,"#4d2817");
    ctx.fillStyle=woodGrad;ctx.fill();

    ctx.clip();

    // moving fine grain
    const spacing=16;
    const offset=(MODEL.rotation*18)%spacing;
    ctx.globalAlpha=.22;
    for(let x=g.left-spacing+offset;x<g.right+spacing;x+=spacing){
      const grain=ctx.createLinearGradient(x,0,x+8,0);
      grain.addColorStop(0,"rgba(74,34,15,0)");
      grain.addColorStop(.5,"rgba(63,29,13,.7)");
      grain.addColorStop(1,"rgba(74,34,15,0)");
      ctx.strokeStyle=grain;ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(x,g.cy-g.maxRadiusPx*1.2);
      ctx.bezierCurveTo(x+8,g.cy-20,x-5,g.cy+22,x+4,g.cy+g.maxRadiusPx*1.2);
      ctx.stroke();
    }

    // glossy rotating highlight
    ctx.globalAlpha=.18;
    const hi=ctx.createLinearGradient(0,g.cy-g.maxRadiusPx,0,g.cy+g.maxRadiusPx);
    hi.addColorStop(0,"rgba(255,255,255,0)");
    hi.addColorStop(.28,"rgba(255,255,255,.75)");
    hi.addColorStop(.46,"rgba(255,255,255,.08)");
    hi.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=hi;ctx.fillRect(g.left,g.cy-g.maxRadiusPx,g.lengthPx,g.maxRadiusPx*2);
    ctx.restore();

    // edge shadow
    ctx.strokeStyle="rgba(30,14,7,.8)";
    ctx.lineWidth=1.4;
    ctx.beginPath();
    for(let i=0;i<MODEL.sampleCount;i++){
      const t=i/(MODEL.sampleCount-1);
      const x=g.left+t*g.lengthPx;
      const y=g.cy+MODEL.radii[i]*scale;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  function drawToolRest(g) {
    // post
    const p=toolPose();
    roundRect(p.tipX-8,g.toolRestY+3,16,56,5,"#272b2e","#5a6064");

    // actual tool rest bar
    const restGrad=ctx.createLinearGradient(0,g.toolRestY-8,0,g.toolRestY+8);
    restGrad.addColorStop(0,"#9ca1a4");
    restGrad.addColorStop(.4,"#575d61");
    restGrad.addColorStop(1,"#25292b");
    roundRect(g.left-12,g.toolRestY-7,g.lengthPx+24,14,6,restGrad,"#777d80");
  }

  function drawOperatorChisel() {
    const p=toolPose();

    // shaft
    const shaftGrad=ctx.createLinearGradient(p.handleX,p.handleY,p.tipX,p.tipY);
    shaftGrad.addColorStop(0,"#4e5356");
    shaftGrad.addColorStop(.45,"#c5c9cb");
    shaftGrad.addColorStop(.72,"#7b8286");
    shaftGrad.addColorStop(1,"#e0e2e3");

    ctx.strokeStyle=shaftGrad;
    ctx.lineCap="round";
    ctx.lineWidth=13;
    ctx.beginPath();
    ctx.moveTo(p.handleX,p.handleY-31);
    ctx.lineTo(p.tipX,p.tipY+4);
    ctx.stroke();

    // tip
    const vx=p.tipX-p.handleX;
    const vy=p.tipY-(p.handleY-31);
    const len=Math.max(1,Math.hypot(vx,vy));
    const nx=-vy/len, ny=vx/len, ux=vx/len, uy=vy/len;

    ctx.fillStyle="#e3e5e6";
    ctx.beginPath();
    ctx.moveTo(p.tipX+nx*8,p.tipY+ny*8);
    ctx.lineTo(p.tipX-nx*8,p.tipY-ny*8);
    ctx.lineTo(p.tipX+ux*13,p.tipY+uy*13);
    ctx.closePath();ctx.fill();

    // handle
    ctx.save();
    ctx.translate(p.handleX,p.handleY);
    const angle=Math.atan2(p.tipY-(p.handleY-31),p.tipX-p.handleX);
    ctx.rotate(angle+Math.PI/2);

    const hg=ctx.createLinearGradient(-28,0,28,0);
    hg.addColorStop(0,"#3e2113");
    hg.addColorStop(.24,"#7e4827");
    hg.addColorStop(.55,"#b36c36");
    hg.addColorStop(.78,"#75401f");
    hg.addColorStop(1,"#321a10");
    roundRect(-28,-58,56,116,22,hg,"#28170e");

    // ferrule
    const fg=ctx.createLinearGradient(-18,0,18,0);
    fg.addColorStop(0,"#555a5d");fg.addColorStop(.5,"#c6c9ca");fg.addColorStop(1,"#414649");
    roundRect(-17,-64,34,14,5,fg,"#202326");

    if(MODEL.dragging){
      ctx.strokeStyle="rgba(255,255,255,.35)";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(0,0,39,68,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();

    if(!MODEL.dragging){
      ctx.fillStyle="rgba(255,255,255,.55)";
      ctx.font="600 11px system-ui";
      ctx.textAlign="center";
      ctx.fillText("GRAB HANDLE",p.handleX,Math.min(p.g.h-9,p.handleY+79));
    }
  }

  function drawLathe() {
    const g=stageGeometry();
    drawMachine(g);
    drawWood(g);
    drawToolRest(g);
    drawOperatorChisel();
  }

  function localPointer(e) {
    const r=canvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }

  function isOnHandle(x,y){
    const p=toolPose();
    const dx=(x-p.handleX)/44;
    const dy=(y-p.handleY)/74;
    return dx*dx+dy*dy<=1;
  }

  function moveHandleFromPointer(e){
    const pos=localPointer(e);
    const g=stageGeometry();
    MODEL.handleX=clamp(pos.x-MODEL.grabOffsetX,g.left-22,g.right+22);
    MODEL.handleY=clamp(pos.y-MODEL.grabOffsetY,g.toolRestY+88,g.h-48);
    const p=toolPose();
    MODEL.chiselX=p.chiselX;
    MODEL.chiselDepth=p.depthIn;
    updateReadout();
  }

  canvas.addEventListener("pointerdown",e=>{
    if(MODEL.dragging)return;
    const pos=localPointer(e);
    if(!isOnHandle(pos.x,pos.y))return;
    const p=toolPose();
    MODEL.dragging=true;
    MODEL.pointerId=e.pointerId;
    MODEL.grabOffsetX=pos.x-p.handleX;
    MODEL.grabOffsetY=pos.y-p.handleY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove",e=>{
    if(!MODEL.dragging||e.pointerId!==MODEL.pointerId)return;
    moveHandleFromPointer(e);
  });

  function endToolPointer(e){
    if(!MODEL.dragging)return;
    if(e.pointerId!==undefined&&e.pointerId!==MODEL.pointerId)return;
    MODEL.dragging=false;
    MODEL.pointerId=null;
    MODEL.chiselDepth=0;
    if(e.pointerId!==undefined&&canvas.hasPointerCapture(e.pointerId)){
      canvas.releasePointerCapture(e.pointerId);
    }
    updateReadout();
  }

  canvas.addEventListener("pointerup",endToolPointer);
  canvas.addEventListener("pointercancel",endToolPointer);

  function rpmToPointerDeg(rpm){
    const t=(rpm-KNOB.min)/(KNOB.max-KNOB.min);
    return KNOB.startDeg+t*KNOB.sweepDeg;
  }

  function setRpm(rpm){
    MODEL.rpm=Math.round(clamp(rpm,KNOB.min,KNOB.max)/50)*50;
    rpmReadout.textContent=String(MODEL.rpm);
    rpmKnob.setAttribute("aria-valuenow",String(MODEL.rpm));
    knobPointer.style.transform=
      `translateX(-50%) rotate(${rpmToPointerDeg(MODEL.rpm)}deg)`;
  }

  function knobPoint(e){
    const r=rpmKnob.getBoundingClientRect();
    return {
      x:e.clientX-(r.left+r.width/2),
      y:e.clientY-(r.top+r.height/2)
    };
  }

  function knobAngleToRpm(e){
    const p=knobPoint(e);
    let deg=Math.atan2(p.y,p.x)*180/Math.PI+90;
    if(deg<0)deg+=360;

    // Convert screen angle to the 270-degree sweep:
    // 225° screen angle = min, then clockwise to 135° = max.
    let sweep=deg-225;
    if(sweep<0)sweep+=360;

    // Dead zone is the lower 90 degrees. Snap to nearest endpoint there.
    if(sweep>270){
      const toMin=360-sweep;
      const toMax=sweep-270;
      sweep=toMin<toMax?0:270;
    }

    const t=clamp(sweep/270,0,1);
    return KNOB.min+t*(KNOB.max-KNOB.min);
  }

  rpmKnob.addEventListener("pointerdown",e=>{
    e.preventDefault();
    KNOB.dragging=true;
    KNOB.pointerId=e.pointerId;
    rpmKnob.setPointerCapture(e.pointerId);
    setRpm(knobAngleToRpm(e));
  });

  rpmKnob.addEventListener("pointermove",e=>{
    if(!KNOB.dragging||e.pointerId!==KNOB.pointerId)return;
    e.preventDefault();
    setRpm(knobAngleToRpm(e));
  });

  function endKnob(e){
    if(!KNOB.dragging)return;
    if(e.pointerId!==undefined&&e.pointerId!==KNOB.pointerId)return;
    KNOB.dragging=false;
    KNOB.pointerId=null;
    if(e.pointerId!==undefined&&rpmKnob.hasPointerCapture(e.pointerId)){
      rpmKnob.releasePointerCapture(e.pointerId);
    }
  }

  rpmKnob.addEventListener("pointerup",endKnob);
  rpmKnob.addEventListener("pointercancel",endKnob);

  rpmKnob.addEventListener("keydown",e=>{
    if(e.key==="ArrowRight"||e.key==="ArrowUp"){
      e.preventDefault();setRpm(MODEL.rpm+50);
    }else if(e.key==="ArrowLeft"||e.key==="ArrowDown"){
      e.preventDefault();setRpm(MODEL.rpm-50);
    }
  });

  function updateReadout(){
    positionReadout.textContent=`${(MODEL.chiselX*MODEL.lengthIn).toFixed(1)} in`;
    diameterReadout.textContent=`${(radiusAtNormalizedX(MODEL.chiselX)*2).toFixed(2)} in`;
    rpmReadout.textContent=String(MODEL.rpm);
  }

  resetBtn.addEventListener("click",resetBlank);
  window.addEventListener("resize",resizeCanvas);

  function frame(now){
    const dt=Math.min(.033,(now-MODEL.lastTime)/1000);
    MODEL.lastTime=now;

    MODEL.rotation+=(MODEL.rpm/60)*Math.PI*2*dt;

    const p=toolPose();
    MODEL.chiselX=p.chiselX;
    MODEL.chiselDepth=MODEL.dragging?p.depthIn:0;

    applyCut(dt);
    updateReadout();
    drawLathe();
    requestAnimationFrame(frame);
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }

  resetBlank();
  resizeCanvas();
  setRpm(900);
  requestAnimationFrame(frame);
})();
