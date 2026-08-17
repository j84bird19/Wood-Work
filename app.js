(() => {
  "use strict";

  const canvas = document.getElementById("latheCanvas");
  const ctx = canvas.getContext("2d", { alpha:false });

  const els = {
    speedArea: document.getElementById("speedArea"),
    toolRestHit: document.getElementById("toolRestHit"),
    sandpaperArea: document.getElementById("sandpaperArea"),
    chiselArea: document.getElementById("chiselArea"),
    finishArea: document.getElementById("finishArea"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalClose: document.getElementById("modalClose"),
    resetBtn: document.getElementById("resetBtn"),
    positionReadout: document.getElementById("positionReadout"),
    diameterReadout: document.getElementById("diameterReadout"),
    speedValueSmall: document.getElementById("speedValueSmall"),
    speedPointerSmall: document.getElementById("speedPointerSmall"),
    activeSandLabel: document.getElementById("activeSandLabel"),
    activeChiselLabel: document.getElementById("activeChiselLabel"),
    activeFinishLabel: document.getElementById("activeFinishLabel")
  };

  const STATE = {
    rpm: 900,
    toolRestHeight: 52,
    toolRestDistance: 38,
    activeMode: "CHISEL",
    activeChisel: "roughing",
    activeSandpaper: "P120",
    activeFinish: "Natural",
    openPopup: null,

    // Turning simulation
    workLengthIn: 18,
    blankDiameterIn: 4,
    samples: 420,
    radii: [],
    cutAmount: [],
    rotation: 0,
    toolX: .52,
    desiredHandleY: 0,
    draggingTool: false,
    toolPointerId: null,
    grabOffsetX: 0,
    grabOffsetY: 0,
    particles: [],
    lastTime: performance.now()
  };

  const CHISELS = [
    {id:"roughing", name:"Roughing Gouge", widthIn:.72, shape:"round"},
    {id:"spindle", name:"Spindle Gouge", widthIn:.48, shape:"round"},
    {id:"bowl", name:"Bowl Gouge", widthIn:.58, shape:"round"},
    {id:"skew", name:"Skew Chisel", widthIn:.46, shape:"skew"},
    {id:"parting", name:"Parting Tool", widthIn:.18, shape:"flat"},
    {id:"scraper", name:"Round Scraper", widthIn:.55, shape:"flat"}
  ];

  const SANDPAPERS = ["P80","P120","P150","P180","P220","P320","P400","P600","P800","P1000","P1500","P2000","P3000"];
  const FINISHES = ["Natural","Honey","Golden Oak","Walnut","Espresso","Charcoal","Blue","Teal","Ochre","Ivory","Forest Green","Custom"];

  const TOOL_VISUAL = {
    scale: 1.12,
    tipToHandlePx: 145,
    handleRadiusX: 17,
    handleRadiusY: 36
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  function resetBlank(){
    STATE.radii = new Array(STATE.samples).fill(STATE.blankDiameterIn/2);
    STATE.cutAmount = new Array(STATE.samples).fill(0);
    STATE.particles = [];
    const g = geometry();
    STATE.toolX = .52;
    STATE.desiredHandleY = g.toolHomeY;
    updateLabels();
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width*dpr));
    canvas.height = Math.max(1, Math.round(rect.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!STATE.draggingTool){
      STATE.desiredHandleY = geometry().toolHomeY;
    }
  }

  function geometry(){
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Spatial map follows user's approved composite.
    const headstockLeft = w*.02;
    const headstockRight = w*.19;

    const blankLeft = w*.205;
    const blankRight = w*.82;
    const centerY = h*.285;
    const maxRadiusPx = Math.min(h*.145, (blankRight-blankLeft)*.10);

    const tailstockX = w*.835;
    const bedTop = h*.60;
    const toolRestY = lerp(h*.43,h*.55,STATE.toolRestHeight/100);
    const toolHomeY = h*.89;

    return {
      w,h,headstockLeft,headstockRight,
      blankLeft,blankRight,blankLengthPx:blankRight-blankLeft,
      centerY,maxRadiusPx,tailstockX,bedTop,toolRestY,toolHomeY
    };
  }

  function radiusAt(t){
    const idx = clamp(Math.round(t*(STATE.samples-1)),0,STATE.samples-1);
    return STATE.radii[idx];
  }

  function currentChisel(){
    return CHISELS.find(c=>c.id===STATE.activeChisel) || CHISELS[0];
  }

  function targetRadius(t){
    // Gentle default spindle silhouette, later replaced by uploaded target profiles.
    if(t<.10) return 1.42;
    if(t<.22) return lerp(1.42,1.16,(t-.10)/.12);
    if(t<.43) return lerp(1.16,.82,(t-.22)/.21);
    if(t<.54) return .74 + .10*Math.sin((t-.43)/.11*Math.PI);
    if(t<.80) return lerp(.78,.48,(t-.54)/.26);
    if(t<.94) return .49 + .14*Math.sin((t-.80)/.14*Math.PI);
    return .47;
  }

  function toolState(){
    const g = geometry();
    const chisel = currentChisel();
    const xNorm = clamp(STATE.toolX,0,1);
    const idx = clamp(Math.round(xNorm*(STATE.samples-1)),0,STATE.samples-1);
    const currentRadius = STATE.radii[idx];
    const pxPerIn = g.maxRadiusPx/(STATE.blankDiameterIn/2);
    const surfaceBottomY = g.centerY + currentRadius*pxPerIn;

    const tipY = STATE.desiredHandleY - TOOL_VISUAL.tipToHandlePx*TOOL_VISUAL.scale;
    const tipX = g.blankLeft + xNorm*g.blankLengthPx;
    const desiredRadius = clamp((tipY-g.centerY)/pxPerIn,.12,STATE.blankDiameterIn/2);
    const contact = STATE.draggingTool && tipY <= surfaceBottomY+2 && desiredRadius < currentRadius+.02;

    return {
      g,chisel,xNorm,idx,currentRadius,pxPerIn,
      surfaceBottomY,tipX,tipY,
      handleX:tipX,handleY:STATE.desiredHandleY,
      desiredRadius,contact
    };
  }

  function influence(d, shape){
    const a = Math.abs(d);
    if(a>1) return 0;
    if(shape==="flat") return a<.82 ? 1 : (1-a)/.18;
    if(shape==="skew"){
      const b = Math.max(0,1-a);
      return d<0 ? Math.min(1,b*1.3) : b*.76;
    }
    return Math.sqrt(Math.max(0,1-a*a));
  }

  function carve(){
    const s = toolState();
    if(!s.contact || STATE.activeMode!=="CHISEL") return;

    const center = s.xNorm*(STATE.samples-1);
    const samplesPerIn = (STATE.samples-1)/STATE.workLengthIn;
    const half = Math.max(1,(s.chisel.widthIn*samplesPerIn)/2);
    const start = Math.max(0,Math.floor(center-half*1.25));
    const end = Math.min(STATE.samples-1,Math.ceil(center+half*1.25));
    let removed=0;

    for(let i=start;i<=end;i++){
      const d=(i-center)/half;
      const inf=influence(d,s.chisel.shape);
      if(inf<=0) continue;
      const shoulderLift=(1-inf)*(s.chisel.widthIn*.18);
      const target=Math.min(STATE.blankDiameterIn/2,s.desiredRadius+shoulderLift);

      if(STATE.radii[i]>target){
        const before=STATE.radii[i];
        STATE.radii[i]=Math.max(target,lerp(STATE.radii[i],target,.87));
        STATE.cutAmount[i]=Math.max(STATE.cutAmount[i],STATE.blankDiameterIn/2-STATE.radii[i]);
        removed+=before-STATE.radii[i];
      }
    }
    if(removed>.0003) spawnChips(s,Math.min(9,2+Math.floor(removed*125)));
  }

  function spawnChips(s,count){
    for(let i=0;i<count;i++){
      STATE.particles.push({
        x:s.tipX+(Math.random()-.5)*10,
        y:s.surfaceBottomY,
        vx:(Math.random()-.5)*100,
        vy:35+Math.random()*125,
        life:.45+Math.random()*.55,
        age:0,
        size:1.5+Math.random()*4,
        r:(Math.random()-.5)*5,
        rot:Math.random()*Math.PI
      });
    }
    if(STATE.particles.length>160) STATE.particles.splice(0,STATE.particles.length-160);
  }

  function updateParticles(dt){
    for(const p of STATE.particles){
      p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.rot+=p.r*dt;
    }
    STATE.particles=STATE.particles.filter(p=>p.age<p.life);
  }

  function rr(x,y,w,h,r,fill,stroke,lw=1){
    const q=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);
    ctx.beginPath();ctx.moveTo(x+q,y);
    ctx.arcTo(x+w,y,x+w,y+h,q);
    ctx.arcTo(x+w,y+h,x,y+h,q);
    ctx.arcTo(x,y+h,x,y,q);
    ctx.arcTo(x,y,x+w,y,q);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}
  }

  function drawMachine(g){
    // Neutral shop background
    const bg=ctx.createLinearGradient(0,0,0,g.h);
    bg.addColorStop(0,"#eeeae4");
    bg.addColorStop(.65,"#ded9d2");
    bg.addColorStop(1,"#b99a7a");
    ctx.fillStyle=bg;ctx.fillRect(0,0,g.w,g.h);

    // Bench surface
    ctx.fillStyle="#ad845e";
    ctx.fillRect(0,g.h*.83,g.w,g.h*.17);
    ctx.fillStyle="rgba(75,43,22,.12)";
    for(let y=g.h*.84;y<g.h;y+=11){ctx.fillRect(0,y,g.w,1)}

    // Bed
    const bedY=g.bedTop;
    const bedGrad=ctx.createLinearGradient(0,bedY,0,bedY+68);
    bedGrad.addColorStop(0,"#a6aaad");
    bedGrad.addColorStop(.18,"#5f6568");
    bedGrad.addColorStop(.7,"#34383a");
    bedGrad.addColorStop(1,"#191c1e");
    rr(g.w*.055,bedY,g.w*.86,g.h*.16,6,bedGrad,"#25292b",2);
    rr(g.w*.08,bedY+10,g.w*.79,9,4,"#777d80");
    rr(g.w*.08,bedY+26,g.w*.79,8,4,"#474c4f");

    // Headstock housing (speed module overlays left-front of this)
    const hsx=g.w*.04,hsy=g.h*.08,hsw=g.w*.17,hsh=g.h*.54;
    const hg=ctx.createLinearGradient(hsx,hsy,hsx+hsw,hsy);
    hg.addColorStop(0,"#1b1f21");hg.addColorStop(.38,"#4b5053");hg.addColorStop(1,"#24282b");
    rr(hsx,hsy,hsw,hsh,9,hg,"#656b6e",2);
    rr(hsx+hsw*.66,hsy+hsh*.18,hsw*.34,hsh*.58,8,"#24282a","#686e71",2);

    // Chuck / spindle
    const chuckX=g.blankLeft-20;
    const cg=ctx.createLinearGradient(chuckX-38,0,chuckX+10,0);
    cg.addColorStop(0,"#272b2d");cg.addColorStop(.35,"#898e91");cg.addColorStop(.58,"#363a3d");cg.addColorStop(1,"#aeb2b4");
    rr(chuckX-34,g.centerY-g.maxRadiusPx*.63,34,g.maxRadiusPx*1.26,5,cg,"#1d2022",1.5);
    ctx.fillStyle="#666c70";ctx.beginPath();ctx.arc(chuckX,g.centerY,11,0,Math.PI*2);ctx.fill();

    // Tailstock
    const tx=g.tailstockX,ty=g.h*.21;
    const tg=ctx.createLinearGradient(tx,ty,tx+g.w*.09,ty);
    tg.addColorStop(0,"#292d30");tg.addColorStop(.55,"#646a6e");tg.addColorStop(1,"#222629");
    rr(tx,ty,g.w*.075,g.h*.39,8,tg,"#555b5e",2);
    rr(tx+g.w*.05,g.centerY-13,g.w*.07,26,6,"#555b5e","#282c2e");
    ctx.strokeStyle="#8c9295";ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(tx+g.w*.075,g.centerY);ctx.lineTo(tx+g.w*.105,g.centerY);ctx.stroke();
    ctx.fillStyle="#a9adaf";ctx.beginPath();ctx.arc(tx+g.w*.115,g.centerY,11,0,Math.PI*2);ctx.fill();

    // Tool rest — large centered under blank like mockup
    const restTop=g.toolRestY;
    const restLeft=g.w*.315;
    const restRight=g.w*.765;
    const rg=ctx.createLinearGradient(0,restTop-8,0,restTop+48);
    rg.addColorStop(0,"#6e7477");rg.addColorStop(.28,"#414649");rg.addColorStop(1,"#1f2325");
    ctx.beginPath();
    ctx.moveTo(restLeft,restTop);
    ctx.quadraticCurveTo((restLeft+restRight)/2,restTop+34,restRight,restTop);
    ctx.lineTo(restRight-18,restTop+24);
    ctx.quadraticCurveTo((restLeft+restRight)/2,restTop+58,restLeft+18,restTop+24);
    ctx.closePath();ctx.fillStyle=rg;ctx.fill();ctx.strokeStyle="#202426";ctx.stroke();
    rr(g.w*.515,restTop+36,g.w*.045,g.h*.18,4,"#353a3c","#171a1c",1.5);
    rr(g.w*.495,restTop+g.h*.14,g.w*.085,g.h*.09,5,"#303436","#15181a",1.5);
  }

  function currentProfilePath(g){
    const scale=g.maxRadiusPx/(STATE.blankDiameterIn/2);
    ctx.beginPath();
    for(let i=0;i<STATE.samples;i++){
      const t=i/(STATE.samples-1);
      const x=g.blankLeft+t*g.blankLengthPx;
      const y=g.centerY-STATE.radii[i]*scale;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    for(let i=STATE.samples-1;i>=0;i--){
      const t=i/(STATE.samples-1);
      const x=g.blankLeft+t*g.blankLengthPx;
      const y=g.centerY+STATE.radii[i]*scale;
      ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  function drawWood(g){
    const scale=g.maxRadiusPx/(STATE.blankDiameterIn/2);
    currentProfilePath(g);

    const wood=ctx.createLinearGradient(0,g.centerY-g.maxRadiusPx,0,g.centerY+g.maxRadiusPx);
    wood.addColorStop(0,"#855024");
    wood.addColorStop(.18,"#c47d38");
    wood.addColorStop(.40,"#e6aa65");
    wood.addColorStop(.52,"#f0bd7a");
    wood.addColorStop(.74,"#b86c2e");
    wood.addColorStop(1,"#74401d");
    ctx.fillStyle=wood;ctx.fill();

    ctx.save();
    currentProfilePath(g);ctx.clip();

    // Strong movement cue: rotating highlight + circumference grain
    const sweepY=g.centerY+Math.sin(STATE.rotation)*g.maxRadiusPx*.72;
    const shine=ctx.createLinearGradient(0,sweepY-25,0,sweepY+25);
    shine.addColorStop(0,"rgba(255,255,255,0)");
    shine.addColorStop(.48,"rgba(255,246,215,.38)");
    shine.addColorStop(.53,"rgba(255,255,255,.13)");
    shine.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=shine;ctx.fillRect(g.blankLeft,g.centerY-g.maxRadiusPx,g.blankLengthPx,g.maxRadiusPx*2);

    const yoff=(STATE.rotation*13)%14;
    ctx.globalAlpha=.25;ctx.strokeStyle="#6b3515";ctx.lineWidth=1.2;
    for(let y=g.centerY-g.maxRadiusPx-14+yoff;y<g.centerY+g.maxRadiusPx+14;y+=14){
      ctx.beginPath();ctx.moveTo(g.blankLeft,y);
      for(let j=1;j<=26;j++){
        const x=g.blankLeft+(j/26)*g.blankLengthPx;
        ctx.lineTo(x,y+Math.sin(j*.72+STATE.rotation*.33)*2);
      }
      ctx.stroke();
    }
    ctx.restore();

    // darker rough surface remnants
    ctx.save();
    for(let i=0;i<STATE.samples-1;i++){
      const cut=STATE.cutAmount[i];
      const opacity=clamp(1-cut/.045,0,1);
      if(opacity<=0)continue;
      const t0=i/(STATE.samples-1),t1=(i+1)/(STATE.samples-1);
      const x0=g.blankLeft+t0*g.blankLengthPx;
      const x1=g.blankLeft+t1*g.blankLengthPx;
      const r=STATE.radii[i]*scale;
      const top=g.centerY-r,bottom=g.centerY+r;
      const shade=Math.sin(STATE.rotation+i*.12);
      ctx.globalAlpha=.44*opacity;
      ctx.fillStyle=shade>0?"#6c351f":"#4e271b";
      ctx.fillRect(x0,top,x1-x0+1,bottom-top);
    }
    ctx.restore();

    // Target profile
    ctx.strokeStyle="rgba(31,20,15,.76)";
    ctx.lineWidth=1.7;
    ctx.beginPath();
    for(let i=0;i<=180;i++){
      const t=i/180;
      const x=g.blankLeft+t*g.blankLengthPx;
      const y=g.centerY-targetRadius(t)*scale;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    for(let i=180;i>=0;i--){
      const t=i/180;
      const x=g.blankLeft+t*g.blankLengthPx;
      const y=g.centerY+targetRadius(t)*scale;
      ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.stroke();

    // Rotating endcap marker
    ctx.save();ctx.translate(g.blankLeft,g.centerY);ctx.rotate(STATE.rotation);
    ctx.strokeStyle="rgba(54,25,10,.50)";ctx.lineWidth=1.3;
    for(let k=0;k<5;k++){
      const a=k*Math.PI*2/5;
      ctx.beginPath();ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*5,Math.sin(a)*STATE.radii[0]*scale*.88);ctx.stroke();
    }
    ctx.restore();
  }

  function drawChisel(){
    if(STATE.activeMode!=="CHISEL") return;
    const s=toolState();
    const scale=TOOL_VISUAL.scale;
    const x=s.tipX,y=s.tipY,hy=s.handleY;

    const steel=ctx.createLinearGradient(x-10,0,x+10,0);
    steel.addColorStop(0,"#666c70");steel.addColorStop(.28,"#d6dbdd");
    steel.addColorStop(.52,"#fbfcfc");steel.addColorStop(1,"#6b7175");

    // fixed-size shaft
    ctx.fillStyle=steel;
    const shaftBottom=hy-45*scale;
    if(s.chisel.shape==="skew"){
      ctx.beginPath();
      ctx.moveTo(x-10*scale,y+8*scale);ctx.lineTo(x+10*scale,y);
      ctx.lineTo(x+8*scale,shaftBottom);ctx.lineTo(x-8*scale,shaftBottom);
      ctx.closePath();ctx.fill();
    }else if(s.chisel.shape==="flat"){
      rr(x-4*scale,y,8*scale,Math.max(3,shaftBottom-y),2,steel,"#555b5e");
    }else{
      ctx.beginPath();
      ctx.moveTo(x-10*scale,y+5*scale);ctx.lineTo(x-7*scale,shaftBottom);
      ctx.lineTo(x+7*scale,shaftBottom);ctx.lineTo(x+10*scale,y+5*scale);
      ctx.closePath();ctx.fill();
      ctx.fillStyle="#e9edee";ctx.beginPath();ctx.ellipse(x,y+4*scale,10*scale,4*scale,0,Math.PI,Math.PI*2);ctx.fill();
    }

    // ferrule
    const ferrule=ctx.createLinearGradient(x-14,0,x+14,0);
    ferrule.addColorStop(0,"#6e4312");ferrule.addColorStop(.45,"#e1b44f");ferrule.addColorStop(.7,"#ffe17c");ferrule.addColorStop(1,"#754511");
    rr(x-14*scale,hy-52*scale,28*scale,14*scale,4,ferrule,"#57330e");

    // fixed handle
    const hg=ctx.createLinearGradient(x-18,0,x+18,0);
    hg.addColorStop(0,"#5d2f14");hg.addColorStop(.28,"#b66527");hg.addColorStop(.53,"#e89a48");hg.addColorStop(.78,"#9b4d1c");hg.addColorStop(1,"#4b2511");
    ctx.beginPath();
    ctx.moveTo(x-13*scale,hy-34*scale);
    ctx.quadraticCurveTo(x-18*scale,hy-16*scale,x-15*scale,hy+8*scale);
    ctx.quadraticCurveTo(x-11*scale,hy+31*scale,x,hy+36*scale);
    ctx.quadraticCurveTo(x+11*scale,hy+31*scale,x+15*scale,hy+8*scale);
    ctx.quadraticCurveTo(x+18*scale,hy-16*scale,x+13*scale,hy-34*scale);
    ctx.closePath();ctx.fillStyle=hg;ctx.fill();ctx.strokeStyle="#48230f";ctx.lineWidth=1.5;ctx.stroke();

    if(STATE.draggingTool){
      ctx.strokeStyle="rgba(182,255,69,.75)";ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(x,hy,25*scale,46*scale,0,0,Math.PI*2);ctx.stroke();
    }
  }

  function drawParticles(){
    for(const p of STATE.particles){
      const a=clamp(1-p.age/p.life,0,1);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=a;
      ctx.fillStyle="#ba6d32";rr(-p.size/2,-1,p.size,2,1,"#ba6d32");ctx.restore();
    }
  }

  function draw(){
    const g=geometry();
    drawMachine(g);
    drawWood(g);
    drawParticles();
    drawChisel();
  }

  function localPointer(e){
    const r=canvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }

  function handleHit(x,y){
    const s=toolState();
    const dx=(x-s.handleX)/(TOOL_VISUAL.handleRadiusX*TOOL_VISUAL.scale*1.45);
    const dy=(y-s.handleY)/(TOOL_VISUAL.handleRadiusY*TOOL_VISUAL.scale*1.35);
    return dx*dx+dy*dy<=1;
  }

  canvas.addEventListener("pointerdown",e=>{
    if(STATE.activeMode!=="CHISEL" || STATE.draggingTool) return;
    const p=localPointer(e);
    if(!handleHit(p.x,p.y)) return;
    const s=toolState();
    STATE.draggingTool=true;
    STATE.toolPointerId=e.pointerId;
    STATE.grabOffsetX=p.x-s.handleX;
    STATE.grabOffsetY=p.y-s.handleY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove",e=>{
    if(!STATE.draggingTool || e.pointerId!==STATE.toolPointerId) return;
    const p=localPointer(e);
    const g=geometry();
    const desiredX=p.x-STATE.grabOffsetX;
    const desiredY=p.y-STATE.grabOffsetY;

    STATE.toolX=clamp((desiredX-g.blankLeft)/g.blankLengthPx,0,1);

    const minY=g.centerY+TOOL_VISUAL.tipToHandlePx*TOOL_VISUAL.scale+5;
    const maxY=g.h*.96;
    STATE.desiredHandleY=clamp(desiredY,minY,maxY);
  });

  function endTool(e){
    if(!STATE.draggingTool) return;
    if(e.pointerId!==undefined && e.pointerId!==STATE.toolPointerId) return;
    STATE.draggingTool=false;STATE.toolPointerId=null;
    if(e.pointerId!==undefined && canvas.hasPointerCapture(e.pointerId)){
      canvas.releasePointerCapture(e.pointerId);
    }
  }
  canvas.addEventListener("pointerup",endTool);
  canvas.addEventListener("pointercancel",endTool);

  // ===== Popup system =====
  let openingArea=null;

  function openPopup(type, area){
    closePopup(false);
    openingArea=area;
    area.classList.add("area-open");
    STATE.openPopup=type;
    els.modalBackdrop.hidden=false;

    if(type==="speed") renderSpeedPopup();
    if(type==="rest") renderRestPopup();
    if(type==="sand") renderSandPopup();
    if(type==="chisel") renderChiselPopup();
    if(type==="finish") renderFinishPopup();
  }

  function closePopup(removeClass=true){
    if(removeClass && openingArea) openingArea.classList.remove("area-open");
    openingArea=null;
    STATE.openPopup=null;
    els.modalBackdrop.hidden=true;
  }

  els.modalClose.addEventListener("click",()=>closePopup());
  els.modalBackdrop.addEventListener("pointerdown",e=>{
    if(e.target===els.modalBackdrop) closePopup();
  });

  function renderSpeedPopup(){
    els.modalTitle.textContent="Lathe Speed";
    els.modalBody.innerHTML=`
      <div class="speed-popup">
        <div class="large-knob-wrap">
          <div id="largeKnob" class="large-knob" role="slider" aria-label="RPM" aria-valuemin="200" aria-valuemax="3200">
            <i id="largePointer" class="pointer"></i>
            <b id="largeValue" class="value">${STATE.rpm}</b>
          </div>
        </div>
        <div class="speed-popup-info">
          <strong><span id="speedBigText">${STATE.rpm}</span> RPM</strong>
          <span>Turn clockwise to increase speed. Counter-clockwise to decrease.</span>
          <span>This adjustment does not change the active tool.</span>
        </div>
      </div>`;

    const knob=document.getElementById("largeKnob");
    const pointer=document.getElementById("largePointer");
    let dragging=false,pid=null;

    const update=()=>{
      const deg=rpmToDegrees(STATE.rpm);
      pointer.style.transform=`translateX(-50%) rotate(${deg}deg)`;
      document.getElementById("largeValue").textContent=STATE.rpm;
      document.getElementById("speedBigText").textContent=STATE.rpm;
      updateSpeedVisual();
    };
    const fromPointer=e=>{
      const r=knob.getBoundingClientRect();
      const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
      let deg=Math.atan2(dy,dx)*180/Math.PI+90;if(deg<0)deg+=360;
      let sweep=deg-225;if(sweep<0)sweep+=360;
      if(sweep>270) sweep=(360-sweep)<(sweep-270)?0:270;
      STATE.rpm=Math.round((200+sweep/270*3000)/50)*50;
      STATE.rpm=clamp(STATE.rpm,200,3200);
      update();
    };
    knob.addEventListener("pointerdown",e=>{dragging=true;pid=e.pointerId;knob.setPointerCapture(pid);fromPointer(e)});
    knob.addEventListener("pointermove",e=>{if(dragging&&e.pointerId===pid)fromPointer(e)});
    knob.addEventListener("pointerup",e=>{dragging=false;if(knob.hasPointerCapture(e.pointerId))knob.releasePointerCapture(e.pointerId)});
    update();
  }

  function renderRestPopup(){
    els.modalTitle.textContent="Tool Rest";
    els.modalBody.innerHTML=`
      <div class="rest-popup">
        <div class="rest-preview">
          <i class="wood"></i>
          <i id="restPreview" class="rest"></i>
        </div>
        <div class="rest-controls">
          <label>HEIGHT <b id="restHeightValue">${STATE.toolRestHeight}%</b>
            <input id="restHeight" type="range" min="0" max="100" value="${STATE.toolRestHeight}">
          </label>
          <label>DISTANCE <b id="restDistanceValue">${STATE.toolRestDistance}%</b>
            <input id="restDistance" type="range" min="0" max="100" value="${STATE.toolRestDistance}">
          </label>
          <small>Adjusting the rest does not replace the active chisel.</small>
        </div>
      </div>`;
    const h=document.getElementById("restHeight"),d=document.getElementById("restDistance");
    const update=()=>{
      STATE.toolRestHeight=+h.value;STATE.toolRestDistance=+d.value;
      document.getElementById("restHeightValue").textContent=`${STATE.toolRestHeight}%`;
      document.getElementById("restDistanceValue").textContent=`${STATE.toolRestDistance}%`;
      document.getElementById("restPreview").style.top=`${54+STATE.toolRestHeight*.12}%`;
    };
    h.addEventListener("input",update);d.addEventListener("input",update);update();
  }

  function renderSandPopup(){
    els.modalTitle.textContent="Sandpaper";
    els.modalBody.innerHTML=`<div class="option-grid">${
      SANDPAPERS.map(g=>`<button class="option ${g===STATE.activeSandpaper?"selected":""}" data-sand="${g}">${g}<small>Select grit</small></button>`).join("")
    }</div>`;
    els.modalBody.querySelectorAll("[data-sand]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        STATE.activeSandpaper=btn.dataset.sand;
        STATE.activeMode="SANDPAPER";
        updateLabels();closePopup();
      });
    });
  }

  function renderChiselPopup(){
    els.modalTitle.textContent="Chisels";
    els.modalBody.innerHTML=`<div class="option-grid">${
      CHISELS.map(c=>`<button class="option ${c.id===STATE.activeChisel?"selected":""}" data-chisel="${c.id}">${c.name}<small>${c.widthIn.toFixed(2)}" cutter</small></button>`).join("")
    }</div>`;
    els.modalBody.querySelectorAll("[data-chisel]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        STATE.activeChisel=btn.dataset.chisel;
        STATE.activeMode="CHISEL";
        updateLabels();closePopup();
      });
    });
  }

  function renderFinishPopup(){
    els.modalTitle.textContent="Paint / Stain";
    els.modalBody.innerHTML=`<div class="option-grid">${
      FINISHES.map(f=>`<button class="option ${f===STATE.activeFinish?"selected":""}" data-finish="${f}">${f}<small>Select finish</small></button>`).join("")
    }</div>`;
    els.modalBody.querySelectorAll("[data-finish]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        STATE.activeFinish=btn.dataset.finish;
        STATE.activeMode="FINISH";
        updateLabels();closePopup();
      });
    });
  }

  els.speedArea.addEventListener("click",()=>openPopup("speed",els.speedArea));
  els.toolRestHit.addEventListener("click",()=>openPopup("rest",els.toolRestHit));
  els.sandpaperArea.addEventListener("click",()=>openPopup("sand",els.sandpaperArea));
  els.chiselArea.addEventListener("click",()=>openPopup("chisel",els.chiselArea));
  els.finishArea.addEventListener("click",()=>openPopup("finish",els.finishArea));

  els.resetBtn.addEventListener("click",resetBlank);

  function rpmToDegrees(rpm){
    return -135+((rpm-200)/3000)*270;
  }

  function updateSpeedVisual(){
    els.speedValueSmall.textContent=STATE.rpm;
    els.speedPointerSmall.style.transform=`translateX(-50%) rotate(${rpmToDegrees(STATE.rpm)}deg)`;
  }

  function updateLabels(){
    els.positionReadout.textContent=`${(STATE.toolX*STATE.workLengthIn).toFixed(1)}"`;
    els.diameterReadout.textContent=`${(radiusAt(STATE.toolX)*2).toFixed(2)}"`;
    els.activeSandLabel.textContent=STATE.activeSandpaper;
    els.activeChiselLabel.textContent=currentChisel().name;
    els.activeFinishLabel.textContent=STATE.activeFinish;
    updateSpeedVisual();

    // visible active cards
    document.querySelectorAll(".sand-card").forEach(c=>c.classList.remove("active"));
    const sandIndex=Math.max(0,["P120","P180","P220","P320","P400","P600","P800","P1000"].indexOf(STATE.activeSandpaper));
    const sandCards=document.querySelectorAll(".sand-card");
    if(sandCards[sandIndex]) sandCards[sandIndex].classList.add("active");

    document.querySelectorAll(".rack-tool").forEach(c=>c.classList.remove("active"));
    const ci=CHISELS.findIndex(c=>c.id===STATE.activeChisel);
    const rack=document.querySelectorAll(".rack-tool");
    if(rack[ci]) rack[ci].classList.add("active");

    document.querySelectorAll(".finish-chip").forEach(c=>c.classList.remove("active"));
    const finishMap={"Natural":0,"Honey":1,"Golden Oak":1,"Walnut":2,"Espresso":3,"Charcoal":4,"Blue":5,"Teal":6,"Ochre":7,"Ivory":8,"Forest Green":9};
    const fi=finishMap[STATE.activeFinish] ?? 0;
    const chips=document.querySelectorAll(".finish-chip");
    if(chips[fi]) chips[fi].classList.add("active");
  }

  window.addEventListener("resize",resize);

  function frame(now){
    const dt=Math.min(.033,(now-STATE.lastTime)/1000);
    STATE.lastTime=now;
    STATE.rotation+=(STATE.rpm/60)*Math.PI*2*dt;

    carve();
    updateParticles(dt);
    updateLabels();
    draw();
    requestAnimationFrame(frame);
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }

  resize();
  resetBlank();
  updateSpeedVisual();
  requestAnimationFrame(frame);
})();
