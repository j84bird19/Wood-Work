(() => {
  "use strict";

  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d",{alpha:false});
  const resetBtn = document.getElementById("resetBtn");
  const positionReadout = document.getElementById("positionReadout");
  const diameterReadout = document.getElementById("diameterReadout");
  const rpmKnob = document.getElementById("rpmKnob");
  const knobPointer = document.getElementById("knobPointer");
  const rpmReadout = document.getElementById("rpmReadout");
  const toolButtons = [...document.querySelectorAll(".tool-btn")];

  const MODEL = {
    lengthIn: 18,
    blankDiameterIn: 4,
    samples: 360,
    radii: [],
    cutAmount: [],
    rpm: 900,
    rotation: 0,
    toolX: .50,
    handleY: 0,
    homeHandleY: 0,
    draggingTool: false,
    toolPointerId: null,
    grabOffsetX: 0,
    grabOffsetY: 0,
    selectedTool: "roughing",
    lastTime: performance.now(),
    particles: []
  };

  const TOOL_DEFS = {
    roughing: {
      label:"Roughing Gouge",
      widthIn:.70,
      biteIn:.075,
      rate:.78,
      influence:"round"
    },
    skew: {
      label:"Skew Chisel",
      widthIn:.50,
      biteIn:.055,
      rate:.58,
      influence:"skew"
    },
    parting: {
      label:"Parting Tool",
      widthIn:.20,
      biteIn:.045,
      rate:.46,
      influence:"flat"
    }
  };

  // v0.2.1 — fixed-size rigid-body chisel.
  const TOOL_VISUAL = {
    scale: 1.16,
    tipToHandleCenterPx: 154,
    handleHalfWidthPx: 18,
    handleTopFromCenterPx: 36,
    handleBottomFromCenterPx: 37,
    ferruleTopFromCenterPx: 50,
    shaftHalfWidthPx: 9
  };

  const KNOB = {
    min:200,max:3200,startDeg:-135,sweepDeg:270,
    dragging:false,pointerId:null
  };

  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  function resize(){
    const r=canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(r.width*dpr));
    canvas.height=Math.max(1,Math.round(r.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const g=geom();
    if(!MODEL.draggingTool){
      MODEL.toolX=.50;
      MODEL.homeHandleY=g.toolHomeY;
      MODEL.handleY=g.toolHomeY;
    }
  }

  function geom(){
    const w=canvas.clientWidth,h=canvas.clientHeight;

    // Layout intentionally mirrors the reference interaction:
    // large blank across upper-middle, open work area below, upright tool from bottom.
    const workLeft=w*.055;
    const workRight=w*.945;
    const workTop=h*.10;
    const workBottom=h*.58;

    const blankLeft=w*.085;
    const blankRight=w*.915;
    const centerY=h*.315;
    const maxRadiusPx=Math.min(h*.145,(blankRight-blankLeft)*.23);

    const toolHomeY=h*.755;
    const toolMinHandleY=centerY+maxRadiusPx+66;

    return {
      w,h,workLeft,workRight,workTop,workBottom,
      blankLeft,blankRight,blankLengthPx:blankRight-blankLeft,
      centerY,maxRadiusPx,toolHomeY,toolMinHandleY
    };
  }

  function targetRadius(t){
    // Default spindle target for the prep simulator.
    // This will later be replaced by uploaded SVG/profile stencils.
    const x=t;

    // left bulb / foot
    if(x<.13){
      const u=x/.13;
      return lerp(1.42,1.20,Math.sin(u*Math.PI/2));
    }

    // left narrowing shoulder
    if(x<.36){
      const u=(x-.13)/.23;
      return lerp(1.20,.82,u);
    }

    // central neck / bead region
    if(x<.47){
      const u=(x-.36)/.11;
      return lerp(.82,.64,Math.sin(u*Math.PI/2));
    }
    if(x<.58){
      const u=(x-.47)/.11;
      return .64 + .08*Math.sin(u*Math.PI);
    }

    // long right taper
    if(x<.83){
      const u=(x-.58)/.25;
      return lerp(.72,.47,u);
    }

    // small end knob
    if(x<.94){
      const u=(x-.83)/.11;
      return .47 + .18*Math.sin(u*Math.PI);
    }

    return .48;
  }

  function resetBlank(){
    MODEL.radii=new Array(MODEL.samples).fill(MODEL.blankDiameterIn/2);
    MODEL.cutAmount=new Array(MODEL.samples).fill(0);
    MODEL.particles=[];
    const g=geom();
    MODEL.toolX=.50;
    MODEL.homeHandleY=g.toolHomeY;
    MODEL.handleY=g.toolHomeY;
    MODEL.draggingTool=false;
    MODEL.toolPointerId=null;
    updateReadout();
  }

  function sampleIndex(t){
    return clamp(Math.round(t*(MODEL.samples-1)),0,MODEL.samples-1);
  }

  function radiusAt(t){
    return MODEL.radii[sampleIndex(t)];
  }

  function toolState(){
    const g=geom();
    const tool=TOOL_DEFS[MODEL.selectedTool];
    const vis=TOOL_VISUAL;
    const s=vis.scale;

    const xNorm=clamp(MODEL.toolX,0,1);
    const idx=sampleIndex(xNorm);
    const currentRadius=MODEL.radii[idx];
    const scale=g.maxRadiusPx/(MODEL.blankDiameterIn/2);
    const surfaceBottomY=g.centerY+currentRadius*scale;

    // The pointer requests a HANDLE position for the whole rigid tool.
    const desiredHandleY=MODEL.handleY;
    const desiredTipY=desiredHandleY-vis.tipToHandleCenterPx*s;

    // The current wood surface limits upward motion.
    // Only a small physical bite can enter the wood at once.
    const maxBitePx=tool.biteIn*scale;
    const deepestAllowedTipY=surfaceBottomY-maxBitePx;

    let actualTipY=desiredTipY;
    let contact=false;

    if(MODEL.draggingTool && desiredTipY < surfaceBottomY){
      contact=true;
      actualTipY=Math.max(desiredTipY,deepestAllowedTipY);
    }

    // Critical fix: actual handle position is derived from actual tip position.
    // Tip-to-handle distance is ALWAYS constant, so the tool cannot stretch.
    const actualHandleY=actualTipY+vis.tipToHandleCenterPx*s;

    // Desired final radius still comes from how far the user is trying to push.
    // Use desiredTipY, not clamped actualTipY, so holding pressure keeps cutting.
    const desiredRadius=
      clamp(
        (desiredTipY-g.centerY)/scale,
        .16,
        MODEL.blankDiameterIn/2
      );

    const tipX=g.blankLeft+xNorm*g.blankLengthPx;

    return {
      g,tool,xNorm,idx,currentRadius,desiredRadius,
      desiredTipY,
      tipX,tipY:actualTipY,
      handleX:tipX,handleY:actualHandleY,
      pointerHandleY:desiredHandleY,
      contact,scale,
      surfaceBottomY,
      visualScale:s
    };
  }

  function toolInfluence(d,kind){
    const a=Math.abs(d);
    if(a>1)return 0;

    if(kind==="flat"){
      return a<=.78?1:(1-a)/.22;
    }
    if(kind==="skew"){
      // asymmetric edge like a skew passing across the profile
      const base=Math.max(0,1-a);
      return d<0 ? Math.min(1,base*1.35) : base*.78;
    }
    return Math.sqrt(Math.max(0,1-a*a));
  }

  function cut(dt){
    const s=toolState();
    if(!MODEL.draggingTool || !s.contact)return;

    const center=s.xNorm*(MODEL.samples-1);
    const samplesPerIn=(MODEL.samples-1)/MODEL.lengthIn;
    const half=Math.max(1,(s.tool.widthIn*samplesPerIn)/2);
    const start=Math.max(0,Math.floor(center-half*1.25));
    const end=Math.min(MODEL.samples-1,Math.ceil(center+half*1.25));

    const rpmFactor=clamp(.55+MODEL.rpm/2800,.60,1.55);
    const frameRemoval=s.tool.rate*rpmFactor*dt;

    let removedTotal=0;

    for(let i=start;i<=end;i++){
      const d=(i-center)/half;
      const influence=toolInfluence(d,s.tool.influence);
      if(influence<=0)continue;

      // Desired radius is shaped by the cutting edge.
      const localDesired=
        (MODEL.blankDiameterIn/2) -
        ((MODEL.blankDiameterIn/2)-s.desiredRadius)*influence;

      if(MODEL.radii[i]>localDesired){
        const demand=MODEL.radii[i]-localDesired;
        const maxBite=s.tool.biteIn*influence;
        const remove=Math.min(demand,maxBite,frameRemoval*influence);
        MODEL.radii[i]-=remove;
        MODEL.cutAmount[i]=Math.max(MODEL.cutAmount[i],(MODEL.blankDiameterIn/2)-MODEL.radii[i]);
        removedTotal+=remove;
      }
    }

    if(removedTotal>.0005){
      spawnChips(s,Math.min(6,1+Math.floor(removedTotal*70)));
    }
  }

  function spawnChips(s,count){
    for(let i=0;i<count;i++){
      MODEL.particles.push({
        x:s.tipX+(Math.random()-.5)*13,
        y:s.surfaceBottomY+Math.random()*5,
        vx:(Math.random()-.5)*105,
        vy:35+Math.random()*150,
        rot:Math.random()*Math.PI,
        vr:(Math.random()-.5)*8,
        size:2+Math.random()*5,
        life:.45+Math.random()*.75,
        age:0,
        tone:Math.random()
      });
    }
    if(MODEL.particles.length>180){
      MODEL.particles.splice(0,MODEL.particles.length-180);
    }
  }

  function updateParticles(dt){
    for(const p of MODEL.particles){
      p.age+=dt;
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.vy+=190*dt;
      p.rot+=p.vr*dt;
    }
    MODEL.particles=MODEL.particles.filter(p=>p.age<p.life);
  }

  function roundRect(x,y,w,h,r,fill,stroke,lineWidth=1){
    const rr=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.lineWidth=lineWidth;ctx.strokeStyle=stroke;ctx.stroke();}
  }

  function drawBackground(g){
    // Warm blurred workshop feeling without copying any original game artwork.
    const wall=ctx.createLinearGradient(0,0,0,g.h);
    wall.addColorStop(0,"#c99868");
    wall.addColorStop(.28,"#d7b184");
    wall.addColorStop(.29,"#85603e");
    wall.addColorStop(1,"#b8a691");
    ctx.fillStyle=wall;
    ctx.fillRect(0,0,g.w,g.h);

    // soft shop shapes
    ctx.save();
    ctx.globalAlpha=.25;
    ctx.filter="blur(5px)";
    ctx.fillStyle="#6f4a2e";
    ctx.fillRect(-20,g.h*.02,g.w+40,18);
    ctx.fillRect(26,g.h*.055,g.w*.25,42);
    ctx.fillRect(g.w*.62,g.h*.045,g.w*.28,34);
    ctx.fillStyle="#9a724d";
    ctx.fillRect(0,g.h*.56,g.w,g.h*.10);
    ctx.restore();
    ctx.filter="none";

    // teal cutting mat / machine guard like the visual role in the reference
    const matX=g.workLeft,matY=g.workTop;
    const matW=g.workRight-g.workLeft,matH=g.workBottom-g.workTop;
    roundRect(matX,matY,matW,matH,7,"#0ca69e","#057e78",4);

    // inner mat
    roundRect(matX+8,matY+8,matW-16,matH-16,4,"#19b8ad","#6be1d6",2);

    // grid
    ctx.save();
    ctx.beginPath();
    ctx.rect(matX+10,matY+10,matW-20,matH-20);
    ctx.clip();
    ctx.strokeStyle="rgba(197,255,246,.28)";
    ctx.lineWidth=1;
    const grid=35;
    for(let x=matX+10;x<=matX+matW-10;x+=grid){
      ctx.beginPath();ctx.moveTo(x,matY+10);ctx.lineTo(x,matY+matH-10);ctx.stroke();
    }
    for(let y=matY+10;y<=matY+matH-10;y+=grid){
      ctx.beginPath();ctx.moveTo(matX+10,y);ctx.lineTo(matX+matW-10,y);ctx.stroke();
    }
    ctx.restore();

    // benchtop below mat
    ctx.fillStyle="#8d725d";
    ctx.fillRect(0,g.workBottom+9,g.w,g.h-g.workBottom-9);
    ctx.fillStyle="rgba(255,255,255,.10)";
    ctx.fillRect(0,g.workBottom+10,g.w,2);
  }

  function currentProfilePath(g){
    const scale=g.maxRadiusPx/(MODEL.blankDiameterIn/2);
    ctx.beginPath();
    for(let i=0;i<MODEL.samples;i++){
      const t=i/(MODEL.samples-1);
      const x=g.blankLeft+t*g.blankLengthPx;
      const y=g.centerY-MODEL.radii[i]*scale;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    for(let i=MODEL.samples-1;i>=0;i--){
      const t=i/(MODEL.samples-1);
      const x=g.blankLeft+t*g.blankLengthPx;
      const y=g.centerY+MODEL.radii[i]*scale;
      ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  function drawWood(g){
    const scale=g.maxRadiusPx/(MODEL.blankDiameterIn/2);

    // Smooth freshly cut wood under everything.
    currentProfilePath(g);
    const fresh=ctx.createLinearGradient(0,g.centerY-g.maxRadiusPx,0,g.centerY+g.maxRadiusPx);
    fresh.addColorStop(0,"#9c5924");
    fresh.addColorStop(.16,"#d3873a");
    fresh.addColorStop(.47,"#eda858");
    fresh.addColorStop(.55,"#c97931");
    fresh.addColorStop(.83,"#dc9143");
    fresh.addColorStop(1,"#8d491f");
    ctx.fillStyle=fresh;
    ctx.fill();

    // Lathe rotation bands / turned wood lines.
    ctx.save();
    currentProfilePath(g);
    ctx.clip();
    ctx.globalAlpha=.22;
    const bandOffset=(MODEL.rotation*8)%12;
    for(let x=g.blankLeft-12+bandOffset;x<g.blankRight+12;x+=12){
      ctx.fillStyle="rgba(92,42,16,.32)";
      ctx.fillRect(x,g.centerY-g.maxRadiusPx*1.2,1.3,g.maxRadiusPx*2.4);
    }
    ctx.restore();

    // Rough outer wood remains only where that X sample has not been carved much.
    // This creates the same visual logic as the reference: rough blank disappears,
    // revealing the smoother turned form underneath.
    ctx.save();
    for(let i=0;i<MODEL.samples-1;i++){
      const t0=i/(MODEL.samples-1),t1=(i+1)/(MODEL.samples-1);
      const x0=g.blankLeft+t0*g.blankLengthPx;
      const x1=g.blankLeft+t1*g.blankLengthPx;
      const cut=MODEL.cutAmount[i];
      const opacity=clamp(1-cut/.055,0,1);
      if(opacity<=0)continue;

      const r=MODEL.radii[i]*scale;
      const top=g.centerY-r;
      const bottom=g.centerY+r;

      const seed=(i*37)%17;
      const bark=seed<4?"#6e2f24":seed<8?"#8d4030":seed<12?"#5d2a22":"#9b4935";
      ctx.globalAlpha=.95*opacity;
      ctx.fillStyle=bark;
      ctx.fillRect(x0-1,top,(x1-x0)+2,bottom-top);

      // bark streak
      if(i%10===0){
        ctx.globalAlpha=.25*opacity;
        ctx.fillStyle="#2d1715";
        ctx.fillRect(x0,top+(seed/17)*(bottom-top),Math.max(2,x1-x0+1),2);
      }
    }
    ctx.restore();

    // A few dark irregular bark veins.
    ctx.save();
    currentProfilePath(g);
    ctx.clip();
    ctx.globalAlpha=.45;
    ctx.strokeStyle="#2a1716";
    ctx.lineWidth=2;
    for(let line=0;line<5;line++){
      ctx.beginPath();
      for(let j=0;j<=18;j++){
        const x=g.blankLeft+(j/18)*g.blankLengthPx;
        const y=g.centerY-g.maxRadiusPx*.60+line*g.maxRadiusPx*.28+
          Math.sin(j*.78+line*1.9)*7;
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Target outline.
    ctx.strokeStyle="#201411";
    ctx.lineWidth=2.3;
    ctx.lineJoin="round";
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
    ctx.closePath();
    ctx.stroke();

    // End caps give a slight lathe-cylinder cue without perspective.
    ctx.strokeStyle="rgba(61,28,11,.45)";
    ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.ellipse(g.blankLeft,g.centerY,6,MODEL.radii[0]*scale,0,0,Math.PI*2);
    ctx.stroke();
  }

  function drawParticles(){
    for(const p of MODEL.particles){
      const a=clamp(1-p.age/p.life,0,1);
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha=a;
      ctx.fillStyle=p.tone>.55?"#e6a052":p.tone>.25?"#b86631":"#7f3e23";
      roundRect(-p.size*.55,-p.size*.22,p.size*1.1,p.size*.44,1,ctx.fillStyle);
      ctx.restore();
    }
  }

  function drawTool(){
    const st=toolState();
    const x=st.tipX;
    const tipY=st.tipY;
    const hY=st.handleY;
    const s=st.visualScale;

    const handleHalf=TOOL_VISUAL.handleHalfWidthPx*s;
    const handleTop=hY-TOOL_VISUAL.handleTopFromCenterPx*s;
    const handleBottom=hY+TOOL_VISUAL.handleBottomFromCenterPx*s;
    const ferruleTop=hY-TOOL_VISUAL.ferruleTopFromCenterPx*s;
    const ferruleH=15*s;
    const shaftBottom=ferruleTop+4*s;

    // Fixed-size metal body. No dimension depends on how far the handle moves.
    const steel=ctx.createLinearGradient(x-11*s,0,x+11*s,0);
    steel.addColorStop(0,"#6b7276");
    steel.addColorStop(.25,"#cbd1d4");
    steel.addColorStop(.52,"#fafbfb");
    steel.addColorStop(.78,"#a2a9ad");
    steel.addColorStop(1,"#656c70");

    ctx.fillStyle=steel;

    if(MODEL.selectedTool==="roughing"){
      ctx.beginPath();
      ctx.moveTo(x-11*s,tipY+5*s);
      ctx.lineTo(x-8*s,shaftBottom);
      ctx.lineTo(x+8*s,shaftBottom);
      ctx.lineTo(x+11*s,tipY+5*s);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle="#e3e7e9";
      ctx.beginPath();
      ctx.ellipse(x,tipY+4*s,11*s,4.5*s,0,Math.PI,Math.PI*2);
      ctx.fill();

      ctx.strokeStyle="rgba(92,99,103,.62)";
      ctx.lineWidth=1.3*s;
      ctx.beginPath();
      ctx.moveTo(x-5*s,tipY+7*s);
      ctx.lineTo(x-3*s,shaftBottom-4*s);
      ctx.stroke();
    }else if(MODEL.selectedTool==="skew"){
      ctx.beginPath();
      ctx.moveTo(x-10*s,tipY+9*s);
      ctx.lineTo(x+10*s,tipY);
      ctx.lineTo(x+8*s,shaftBottom);
      ctx.lineTo(x-8*s,shaftBottom);
      ctx.closePath();
      ctx.fill();
    }else{
      roundRect(
        x-4*s,
        tipY,
        8*s,
        Math.max(2,shaftBottom-tipY),
        2*s,
        steel,
        "#565c60",
        1
      );
      ctx.fillStyle="#edf0f1";
      ctx.fillRect(x-4*s,tipY,8*s,4*s);
    }

    // Fixed-size ferrule.
    const brass=ctx.createLinearGradient(x-15*s,0,x+15*s,0);
    brass.addColorStop(0,"#6e4312");
    brass.addColorStop(.28,"#dcae45");
    brass.addColorStop(.58,"#ffe17b");
    brass.addColorStop(1,"#7b4a13");
    roundRect(x-14*s,ferruleTop,28*s,ferruleH,5*s,brass,"#57340e",1);

    // Fixed-size handle — slightly larger than v0.2.0.
    const handleGrad=ctx.createLinearGradient(x-handleHalf,0,x+handleHalf,0);
    handleGrad.addColorStop(0,"#713914");
    handleGrad.addColorStop(.27,"#c77427");
    handleGrad.addColorStop(.56,"#f3a84b");
    handleGrad.addColorStop(.78,"#a8571e");
    handleGrad.addColorStop(1,"#5e2e11");

    ctx.beginPath();
    ctx.moveTo(x-13*s,handleTop+5*s);
    ctx.quadraticCurveTo(x-handleHalf,handleTop+16*s,x-16*s,hY+5*s);
    ctx.quadraticCurveTo(x-13*s,hY+24*s,x-10*s,handleBottom-6*s);
    ctx.quadraticCurveTo(x,handleBottom,x+10*s,handleBottom-6*s);
    ctx.quadraticCurveTo(x+13*s,hY+24*s,x+16*s,hY+5*s);
    ctx.quadraticCurveTo(x+handleHalf,handleTop+16*s,x+13*s,handleTop+5*s);
    ctx.closePath();
    ctx.fillStyle=handleGrad;
    ctx.fill();
    ctx.strokeStyle="#4c250e";
    ctx.lineWidth=2*s;
    ctx.stroke();

    ctx.fillStyle="#e4b34c";
    ctx.beginPath();
    ctx.ellipse(x,handleBottom-4*s,10*s,4*s,0,0,Math.PI*2);
    ctx.fill();

    if(MODEL.draggingTool){
      ctx.strokeStyle="rgba(202,255,93,.75)";
      ctx.lineWidth=2*s;
      ctx.beginPath();
      ctx.ellipse(x,hY,24*s,47*s,0,0,Math.PI*2);
      ctx.stroke();
    }
  }

  function draw(){
    const g=geom();
    drawBackground(g);
    drawWood(g);
    drawParticles();
    drawTool();
  }

  function pointerLocal(e){
    const r=canvas.getBoundingClientRect();
    return{x:e.clientX-r.left,y:e.clientY-r.top};
  }

  function handleHit(x,y){
    const st=toolState();
    const scale=st.visualScale;
    const dx=(x-st.handleX)/(31*scale);
    const dy=(y-st.handleY)/(52*scale);
    return dx*dx+dy*dy<=1;
  }

  canvas.addEventListener("pointerdown",e=>{
    if(MODEL.draggingTool)return;
    const p=pointerLocal(e);
    if(!handleHit(p.x,p.y))return;

    const s=toolState();
    MODEL.draggingTool=true;
    MODEL.toolPointerId=e.pointerId;
    MODEL.grabOffsetX=p.x-s.handleX;
    MODEL.grabOffsetY=p.y-s.handleY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove",e=>{
    if(!MODEL.draggingTool || e.pointerId!==MODEL.toolPointerId)return;
    const p=pointerLocal(e);
    const g=geom();

    const desiredX=p.x-MODEL.grabOffsetX;
    const desiredY=p.y-MODEL.grabOffsetY;

    MODEL.toolX=clamp((desiredX-g.blankLeft)/g.blankLengthPx,0,1);
    MODEL.handleY=clamp(desiredY,g.toolMinHandleY,g.toolHomeY+28);
    updateReadout();
  });

  function endTool(e){
    if(!MODEL.draggingTool)return;
    if(e.pointerId!==undefined && e.pointerId!==MODEL.toolPointerId)return;
    MODEL.draggingTool=false;
    MODEL.toolPointerId=null;

    if(e.pointerId!==undefined && canvas.hasPointerCapture(e.pointerId)){
      canvas.releasePointerCapture(e.pointerId);
    }
  }

  canvas.addEventListener("pointerup",endTool);
  canvas.addEventListener("pointercancel",endTool);

  toolButtons.forEach(btn=>{
    btn.addEventListener("click",()=>{
      MODEL.selectedTool=btn.dataset.tool;
      toolButtons.forEach(b=>b.classList.toggle("selected",b===btn));
    });
  });

  function rpmToDeg(rpm){
    const t=(rpm-KNOB.min)/(KNOB.max-KNOB.min);
    return KNOB.startDeg+t*KNOB.sweepDeg;
  }

  function setRpm(v){
    MODEL.rpm=Math.round(clamp(v,KNOB.min,KNOB.max)/50)*50;
    rpmReadout.textContent=MODEL.rpm;
    rpmKnob.setAttribute("aria-valuenow",MODEL.rpm);
    knobPointer.style.transform=`translateX(-50%) rotate(${rpmToDeg(MODEL.rpm)}deg)`;
  }

  function knobValue(e){
    const r=rpmKnob.getBoundingClientRect();
    const dx=e.clientX-(r.left+r.width/2);
    const dy=e.clientY-(r.top+r.height/2);
    let deg=Math.atan2(dy,dx)*180/Math.PI+90;
    if(deg<0)deg+=360;
    let sweep=deg-225;
    if(sweep<0)sweep+=360;
    if(sweep>270){
      sweep=(360-sweep)<(sweep-270)?0:270;
    }
    return KNOB.min+(sweep/270)*(KNOB.max-KNOB.min);
  }

  rpmKnob.addEventListener("pointerdown",e=>{
    e.preventDefault();
    KNOB.dragging=true;KNOB.pointerId=e.pointerId;
    rpmKnob.setPointerCapture(e.pointerId);
    setRpm(knobValue(e));
  });

  rpmKnob.addEventListener("pointermove",e=>{
    if(!KNOB.dragging || e.pointerId!==KNOB.pointerId)return;
    e.preventDefault();setRpm(knobValue(e));
  });

  function endKnob(e){
    if(!KNOB.dragging)return;
    if(e.pointerId!==undefined && e.pointerId!==KNOB.pointerId)return;
    KNOB.dragging=false;KNOB.pointerId=null;
    if(e.pointerId!==undefined && rpmKnob.hasPointerCapture(e.pointerId)){
      rpmKnob.releasePointerCapture(e.pointerId);
    }
  }

  rpmKnob.addEventListener("pointerup",endKnob);
  rpmKnob.addEventListener("pointercancel",endKnob);

  function updateReadout(){
    positionReadout.textContent=`${(MODEL.toolX*MODEL.lengthIn).toFixed(1)}"`;
    diameterReadout.textContent=`${(radiusAt(MODEL.toolX)*2).toFixed(2)}"`;
  }

  resetBtn.addEventListener("click",resetBlank);
  window.addEventListener("resize",resize);

  function frame(now){
    const dt=Math.min(.033,(now-MODEL.lastTime)/1000);
    MODEL.lastTime=now;

    MODEL.rotation+=(MODEL.rpm/60)*Math.PI*2*dt;

    cut(dt);
    updateParticles(dt);
    updateReadout();
    draw();

    requestAnimationFrame(frame);
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }

  resize();
  resetBlank();
  setRpm(900);
  requestAnimationFrame(frame);
})();
