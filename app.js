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

    const toolHomeY=Math.min(h*.69,h-210);
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
    const s=TOOL_VISUAL.scale;

    const xNorm=clamp(MODEL.toolX,0,1);
    const idx=sampleIndex(xNorm);
    const currentRadius=MODEL.radii[idx];
    const pxPerIn=g.maxRadiusPx/(MODEL.blankDiameterIn/2);
    const surfaceBottomY=g.centerY+currentRadius*pxPerIn;

    // Reference-style interaction:
    // the rigid tool follows the handle directly. The tool never changes size.
    // The wood is immediately carved to the cutting envelope under the tip,
    // so the cutting edge and surface remain visually synchronized.
    const handleY=MODEL.handleY;
    const tipY=handleY-TOOL_VISUAL.tipToHandleCenterPx*s;
    const tipX=g.blankLeft+xNorm*g.blankLengthPx;

    const desiredRadius=clamp(
      (tipY-g.centerY)/pxPerIn,
      .12,
      MODEL.blankDiameterIn/2
    );

    const contact=
      MODEL.draggingTool &&
      tipY <= surfaceBottomY + 2 &&
      desiredRadius < currentRadius + .02;

    return {
      g,tool,xNorm,idx,currentRadius,desiredRadius,
      tipX,tipY,
      handleX:tipX,handleY,
      contact,
      scale:pxPerIn,
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
    const st=toolState();
    if(!MODEL.draggingTool || !st.contact) return;

    const center=st.xNorm*(MODEL.samples-1);
    const samplesPerIn=(MODEL.samples-1)/MODEL.lengthIn;
    const half=Math.max(1,(st.tool.widthIn*samplesPerIn)/2);

    const start=Math.max(0,Math.floor(center-half*1.25));
    const end=Math.min(MODEL.samples-1,Math.ceil(center+half*1.25));

    let removedTotal=0;

    // RPM now changes chip density and surface animation, but tool position itself
    // determines geometry. This is much closer to the reference app's carving feel.
    const rpmCutFactor=clamp(.70+MODEL.rpm/3000,.75,1.65);
    const smoothing=clamp(.70 + rpmCutFactor*.16,.78,.96);

    for(let i=start;i<=end;i++){
      const d=(i-center)/half;
      const influence=toolInfluence(d,st.tool.influence);
      if(influence<=0) continue;

      const blankRadius=MODEL.blankDiameterIn/2;

      // The cutting edge's shape raises the target radius toward its sides.
      // Center of edge reaches the actual tip depth; shoulders cut less deeply.
      const shoulderLift=(1-influence)*(st.tool.widthIn*.22);
      const localTarget=Math.min(
        blankRadius,
        st.desiredRadius + shoulderLift
      );

      if(MODEL.radii[i] > localTarget){
        const before=MODEL.radii[i];

        // Directly approach the cutter envelope so tip and wood do not fight each other.
        MODEL.radii[i]=Math.max(localTarget,
          lerp(MODEL.radii[i],localTarget,smoothing)
        );

        const removed=before-MODEL.radii[i];
        MODEL.cutAmount[i]=Math.max(
          MODEL.cutAmount[i],
          blankRadius-MODEL.radii[i]
        );
        removedTotal+=removed;
      }
    }

    if(removedTotal>.00025){
      const chips=Math.min(12,2+Math.floor(removedTotal*130*rpmCutFactor));
      spawnChips(st,chips);
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
    const spinPhase=MODEL.rotation;

    // Smooth turned base surface.
    currentProfilePath(g);
    const fresh=ctx.createLinearGradient(0,g.centerY-g.maxRadiusPx,0,g.centerY+g.maxRadiusPx);
    fresh.addColorStop(0,"#76401d");
    fresh.addColorStop(.14,"#bd7030");
    fresh.addColorStop(.34,"#eda858");
    fresh.addColorStop(.51,"#f4bd70");
    fresh.addColorStop(.70,"#bd6d2d");
    fresh.addColorStop(.88,"#e19442");
    fresh.addColorStop(1,"#713b1a");
    ctx.fillStyle=fresh;
    ctx.fill();

    // Strong rotating circumference bands.
    // Their vertical phase changes with RPM/rotation, making spin obvious on a phone.
    ctx.save();
    currentProfilePath(g);
    ctx.clip();

    const radius=g.maxRadiusPx;
    const phase=Math.sin(spinPhase)*0.5+0.5;

    // Sweeping bright reflection rotates around the cylinder.
    const sweepY=g.centerY +
      Math.sin(spinPhase) * radius*.72;
    const shine=ctx.createLinearGradient(0,sweepY-radius*.34,0,sweepY+radius*.34);
    shine.addColorStop(0,"rgba(255,255,255,0)");
    shine.addColorStop(.42,"rgba(255,238,190,.04)");
    shine.addColorStop(.50,"rgba(255,245,210,.42)");
    shine.addColorStop(.58,"rgba(255,238,190,.05)");
    shine.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=shine;
    ctx.fillRect(g.blankLeft,g.centerY-radius*1.1,g.blankLengthPx,radius*2.2);

    // Rotating dark circumference line on opposite side.
    const darkY=g.centerY +
      Math.sin(spinPhase+Math.PI) * radius*.78;
    const shadow=ctx.createLinearGradient(0,darkY-radius*.24,0,darkY+radius*.24);
    shadow.addColorStop(0,"rgba(40,18,7,0)");
    shadow.addColorStop(.50,"rgba(50,22,9,.30)");
    shadow.addColorStop(1,"rgba(40,18,7,0)");
    ctx.fillStyle=shadow;
    ctx.fillRect(g.blankLeft,g.centerY-radius*1.1,g.blankLengthPx,radius*2.2);

    // Moving wood grain/lathe lines.
    const lineOffset=(spinPhase*13) % 18;
    ctx.globalAlpha=.25;
    ctx.strokeStyle="#5c2d13";
    ctx.lineWidth=1.25;
    for(let y=g.centerY-radius*1.2+lineOffset;y<g.centerY+radius*1.2;y+=18){
      ctx.beginPath();
      ctx.moveTo(g.blankLeft,y);
      for(let j=1;j<=22;j++){
        const x=g.blankLeft+(j/22)*g.blankLengthPx;
        const yy=y+Math.sin(j*.72+spinPhase*.45)*2.3;
        ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Rough bark remaining where little/no material has been removed.
    ctx.save();
    for(let i=0;i<MODEL.samples-1;i++){
      const t0=i/(MODEL.samples-1),t1=(i+1)/(MODEL.samples-1);
      const x0=g.blankLeft+t0*g.blankLengthPx;
      const x1=g.blankLeft+t1*g.blankLengthPx;
      const cut=MODEL.cutAmount[i];
      const opacity=clamp(1-cut/.045,0,1);
      if(opacity<=0) continue;

      const r=MODEL.radii[i]*scale;
      const top=g.centerY-r;
      const bottom=g.centerY+r;

      // Bark tone itself also cycles slightly with rotation to mimic a new face
      // of the log coming around.
      const rotBand=Math.sin(spinPhase + i*.18);
      const seed=(i*37)%17;
      let bark;
      if(rotBand>.45) bark=seed<8?"#87402e":"#6e3025";
      else if(rotBand<-.45) bark=seed<8?"#54271f":"#783329";
      else bark=seed<8?"#9a4933":"#683025";

      ctx.globalAlpha=.94*opacity;
      ctx.fillStyle=bark;
      ctx.fillRect(x0-1,top,(x1-x0)+2,bottom-top);

      if(i%9===0){
        ctx.globalAlpha=.32*opacity;
        ctx.fillStyle=rotBand>0?"#d06a45":"#2d1715";
        const veinY=top+((seed/17+.18*Math.sin(spinPhase))%1)*(bottom-top);
        ctx.fillRect(x0,veinY,Math.max(2,x1-x0+1),2);
      }
    }
    ctx.restore();

    // Rotating end-cap spokes: extremely clear motion cue.
    const leftR=MODEL.radii[0]*scale;
    ctx.save();
    ctx.translate(g.blankLeft,g.centerY);
    ctx.strokeStyle="rgba(52,24,10,.55)";
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.ellipse(0,0,6,leftR,0,0,Math.PI*2);
    ctx.stroke();

    ctx.rotate(spinPhase);
    for(let k=0;k<6;k++){
      const a=(Math.PI*2*k)/6;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*5,Math.sin(a)*leftR*.88);
      ctx.stroke();
    }
    ctx.restore();

    // Target profile remains stable over spinning wood.
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

    // Keep handle fully above the fixed control dock, while allowing it
    // to advance far enough to reach the entire target profile.
    const maxHandleY=Math.min(g.toolHomeY+28,g.h-132);
    const minHandleY=g.centerY+TOOL_VISUAL.tipToHandleCenterPx*TOOL_VISUAL.scale+7;
    MODEL.handleY=clamp(desiredY,minHandleY,maxHandleY);
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
