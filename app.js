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

    // v0.3.4 local-contact surface state
    finishCoverage: [],
    finishColor: [],
    finishKind: [],
    sandedAmount: [],

    lastTime: performance.now()
  };

  const CHISELS = [
    {
      id:"roughing", name:"Roughing Gouge", widthIn:.72, shape:"round", visual:"roughing",
      desc:"Wide fluted cutter for quickly rounding a square blank and removing bulk material."
    },
    {
      id:"spindle", name:"Spindle Gouge", widthIn:.48, shape:"round", visual:"spindle",
      desc:"Narrow rounded flute for beads, coves, transitions, and fine spindle detail."
    },
    {
      id:"bowl", name:"Bowl Gouge", widthIn:.58, shape:"round", visual:"bowl",
      desc:"Deep-fluted gouge with a stronger edge for controlled curved cuts."
    },
    {
      id:"skew", name:"Skew Chisel", widthIn:.46, shape:"skew", visual:"skew",
      desc:"Angled cutting edge for planing cuts, V-cuts, beads, and very clean surfaces."
    },
    {
      id:"parting", name:"Parting Tool", widthIn:.18, shape:"flat", visual:"parting",
      desc:"Thin straight cutter for grooves, sizing cuts, and separating sections."
    },
    {
      id:"scraper", name:"Round-Nose Scraper", widthIn:.55, shape:"flat", visual:"scraper",
      desc:"Rounded scraper for smoothing curves and refining areas that are difficult to gouge."
    }
  ];

  const SANDPAPERS = [
    {id:"P80", grit:80, tone:"#522d2a", accent:"#91473f", visual:"maroon", desc:"Very coarse — heavy stock removal and leveling deep tool marks."},
    {id:"P120", grit:120, tone:"#6d3f31", accent:"#b4694f", visual:"rust", desc:"Coarse — initial sanding after turning and removing obvious ridges."},
    {id:"P150", grit:150, tone:"#775235", accent:"#ca8a49", visual:"copper", desc:"Coarse/medium — blends rough sanding scratches before refining."},
    {id:"P180", grit:180, tone:"#8a693d", accent:"#dab869", visual:"tan", desc:"Medium — general smoothing and removing lighter tool marks."},
    {id:"P220", grit:220, tone:"#61656a", accent:"#a4a9af", visual:"slate", desc:"Medium/fine — prepares the surface for finer sanding or many finishes."},
    {id:"P320", grit:320, tone:"#356aa2", accent:"#79a9de", visual:"blue", desc:"Fine — smooth finishing pass before stain, paint, or clear coat."},
    {id:"P400", grit:400, tone:"#d2ac32", accent:"#f0d96c", visual:"yellow", desc:"Very fine — final bare-wood smoothing and between-coat leveling."},
    {id:"P600", grit:600, tone:"#ded7c8", accent:"#f5f0e6", visual:"ivory", desc:"Extra fine — refining finish coats and reducing very small scratches."},
    {id:"P800", grit:800, tone:"#11151a", accent:"#586169", visual:"black", desc:"Polishing grit — smooths clear coats and high-build finishes."},
    {id:"P1000", grit:1000, tone:"#117180", accent:"#5bc0c6", visual:"teal", desc:"Fine polishing — levels tiny finish defects before higher grits."},
    {id:"P1500", grit:1500, tone:"#8d3f69", accent:"#d689b3", visual:"magenta", desc:"Very fine polishing — begins producing a low-gloss polished surface."},
    {id:"P2000", grit:2000, tone:"#4e6e38", accent:"#93c26a", visual:"green", desc:"Ultra fine — refines clear finishes before final polish or buffing."},
    {id:"P3000", grit:3000, tone:"#6a4eb1", accent:"#baa6ef", visual:"violet", desc:"Micro-fine — final polishing prep for a very smooth finished surface."}
  ];

  const FINISHES = [
    {id:"Natural", kind:"Stain", color:"#c89353", apply:"#c89353", desc:"Natural wood tone with minimal color shift and visible grain."},
    {id:"Honey", kind:"Stain", color:"#c67a24", apply:"#be7c2f", desc:"Warm amber stain that strengthens golden and orange wood tones."},
    {id:"Golden Oak", kind:"Stain", color:"#b66d22", apply:"#ae6b26", desc:"Classic golden-brown stain with medium warmth and strong grain visibility."},
    {id:"Walnut", kind:"Stain", color:"#76451f", apply:"#7b4f2f", desc:"Medium-dark brown stain for a traditional walnut appearance."},
    {id:"Espresso", kind:"Stain", color:"#452719", apply:"#4b2e21", desc:"Very dark brown stain while still allowing some wood grain to show."},
    {id:"Charcoal", kind:"Paint", color:"#3e4549", apply:"#454d52", desc:"Opaque charcoal gray paint for a modern dark finish."},
    {id:"Blue", kind:"Paint", color:"#2d6099", apply:"#386eab", desc:"Opaque medium blue paint."},
    {id:"Teal", kind:"Paint", color:"#236e78", apply:"#2b7f89", desc:"Opaque blue-green paint with a deep teal tone."},
    {id:"Ochre", kind:"Paint", color:"#cd8a1e", apply:"#d9962c", desc:"Opaque warm ochre / golden yellow paint."},
    {id:"Ivory", kind:"Paint", color:"#ddd3bf", apply:"#ded5c7", desc:"Opaque warm off-white paint."},
    {id:"Forest Green", kind:"Paint", color:"#315d49", apply:"#386b54", desc:"Opaque deep forest green paint."},
    {id:"Custom", kind:"Paint", color:"linear-gradient(135deg,#e34d59,#e9bb37,#58a86a,#3d77c2,#8c51b8)", apply:"#8c51b8", desc:"Custom paint color — color picker support will be connected later."}
  ];

  const TOOL_VISUAL = {
    scale: 1.12,
    tipToHandlePx: 145,
    handleRadiusX: 17,
    handleRadiusY: 36
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  function shade(hex, amt){
    const h = hex.replace("#","");
    if(h.length!==6) return hex;
    const n = parseInt(h,16);
    let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    const mix = amt>=0 ? 255 : 0;
    const t = Math.abs(amt);
    r=Math.round(r+(mix-r)*t);
    g=Math.round(g+(mix-g)*t);
    b=Math.round(b+(mix-b)*t);
    return "#" + [r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("");
  }

  function resetBlank(){
    STATE.radii = new Array(STATE.samples).fill(STATE.blankDiameterIn/2);
    STATE.cutAmount = new Array(STATE.samples).fill(0);
    STATE.particles = [];
    STATE.finishCoverage = new Array(STATE.samples).fill(0);
    STATE.finishColor = new Array(STATE.samples).fill("#c89353");
    STATE.finishKind = new Array(STATE.samples).fill("None");
    STATE.sandedAmount = new Array(STATE.samples).fill(0);
    placeActiveTool(STATE.activeMode);
    updateLabels();
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width*dpr));
    canvas.height = Math.max(1, Math.round(rect.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!STATE.draggingTool){
      STATE.desiredHandleY = activeToolHome(STATE.activeMode);
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

  function activeToolHome(mode=STATE.activeMode){
    const g=geometry();

    if(mode==="CHISEL"){
      return clamp(g.h*.79, g.centerY+62, Math.max(g.centerY+62,g.h-28));
    }

    if(mode==="SANDPAPER"){
      return clamp(g.h*.75, g.centerY+34, Math.max(g.centerY+34,g.h-26));
    }

    return clamp(g.h*.73, g.centerY+42, Math.max(g.centerY+42,g.h-86));
  }

  function placeActiveTool(mode=STATE.activeMode){
    STATE.toolX=.50;
    STATE.desiredHandleY=activeToolHome(mode);
    STATE.draggingTool=false;
    STATE.toolPointerId=null;
  }

  function radiusAt(t){
    const idx = clamp(Math.round(t*(STATE.samples-1)),0,STATE.samples-1);
    return STATE.radii[idx];
  }

  function currentChisel(){
    return CHISELS.find(c=>c.id===STATE.activeChisel) || CHISELS[0];
  }

  function currentFinish(){
    return FINISHES.find(f=>f.id===STATE.activeFinish) || FINISHES[0];
  }

  function finishApplyColor(){
    return currentFinish().apply || "#c89353";
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
    const rawXNorm = STATE.toolX;
    const xNorm = clamp(rawXNorm,0,1);
    const idx = clamp(Math.round(xNorm*(STATE.samples-1)),0,STATE.samples-1);
    const currentRadius = STATE.radii[idx];
    const pxPerIn = g.maxRadiusPx/(STATE.blankDiameterIn/2);
    const surfaceBottomY = g.centerY + currentRadius*pxPerIn;

    const handleX = g.blankLeft + rawXNorm*g.blankLengthPx;
    const handleY = STATE.desiredHandleY;

    let contactY = handleY;
    let contactWidthIn = .40;

    if(STATE.activeMode==="CHISEL"){
      contactY = handleY - TOOL_VISUAL.tipToHandlePx*TOOL_VISUAL.scale;
      contactWidthIn = currentChisel().widthIn;
    }else if(STATE.activeMode==="SANDPAPER"){
      contactY = handleY - 18;
      contactWidthIn = .95;
    }else if(STATE.activeMode==="FINISH"){
      contactY = handleY - 34;
      contactWidthIn = .58;
    }

    const desiredRadius = clamp((contactY-g.centerY)/pxPerIn,.12,STATE.blankDiameterIn/2);
    const contact = STATE.draggingTool && contactY <= surfaceBottomY+4 && desiredRadius < currentRadius+.10;

    return {
      g, chisel:currentChisel(), xNorm, idx, currentRadius, pxPerIn,
      surfaceBottomY, tipX:handleX, tipY:contactY, contactY, contactWidthIn,
      handleX, handleY, desiredRadius, contact
    };
  }

  function influence(d, chisel){
    const a = Math.abs(d);
    if(a>1) return 0;

    if(chisel.id==="parting"){
      // Narrow groove / sizing cut.
      return a<.45 ? 1 : (1-a)/.55;
    }

    if(chisel.id==="skew"){
      const b = Math.max(0,1-a);
      return d<0 ? Math.min(1,b*1.35) : b*.72;
    }

    if(chisel.id==="scraper"){
      // Broad but shallower smoothing action.
      return Math.pow(Math.max(0,1-a), .75);
    }

    if(chisel.id==="roughing"){
      return Math.sqrt(Math.max(0,1-a*a));
    }

    if(chisel.id==="spindle"){
      // Narrower detail cut.
      return Math.pow(Math.max(0,1-a), 1.25);
    }

    if(chisel.id==="bowl"){
      // Stronger center-biased curve.
      return Math.pow(Math.max(0,1-a*a), .65);
    }

    if(chisel.shape==="flat"){
      return a<.82 ? 1 : (1-a)/.18;
    }

    return Math.sqrt(Math.max(0,1-a*a));
  }

  function applyActiveTool(dt){
    const s=toolState();
    if(!s.contact) return;
    if(STATE.activeMode==="CHISEL") applyChiselContact(s,dt);
    else if(STATE.activeMode==="SANDPAPER") applySandpaperContact(s,dt);
    else if(STATE.activeMode==="FINISH") applyFinishContact(s,dt);
  }

  function contactWindow(s,widthIn,extra=1){
    const center=s.xNorm*(STATE.samples-1);
    const samplesPerIn=(STATE.samples-1)/STATE.workLengthIn;
    const half=Math.max(1,(widthIn*samplesPerIn)/2);
    return {center,half,start:Math.max(0,Math.floor(center-half*extra)),end:Math.min(STATE.samples-1,Math.ceil(center+half*extra))};
  }

  function applyChiselContact(s,dt){
    const w=contactWindow(s,s.chisel.widthIn,1.25);
    let removed=0;

    let shoulderScale=.18;
    let aggressiveness=.78;

    if(s.chisel.id==="roughing"){ shoulderScale=.22; aggressiveness=.92; }
    else if(s.chisel.id==="spindle"){ shoulderScale=.12; aggressiveness=.72; }
    else if(s.chisel.id==="bowl"){ shoulderScale=.15; aggressiveness=.88; }
    else if(s.chisel.id==="skew"){ shoulderScale=.10; aggressiveness=.80; }
    else if(s.chisel.id==="parting"){ shoulderScale=.04; aggressiveness=.96; }
    else if(s.chisel.id==="scraper"){ shoulderScale=.16; aggressiveness=.50; }

    for(let i=w.start;i<=w.end;i++){
      const d=(i-w.center)/w.half;
      const inf=influence(d,s.chisel);
      if(inf<=0) continue;

      const target=Math.min(
        STATE.blankDiameterIn/2,
        s.desiredRadius + (1-inf)*(s.chisel.widthIn*shoulderScale)
      );

      if(STATE.radii[i]>target){
        const before=STATE.radii[i];
        const follow=clamp(.48 + aggressiveness + dt*6, .60, .96);
        STATE.radii[i]=Math.max(target, lerp(STATE.radii[i], target, follow));
        STATE.cutAmount[i]=Math.max(STATE.cutAmount[i],STATE.blankDiameterIn/2-STATE.radii[i]);
        STATE.finishCoverage[i]=Math.max(0,STATE.finishCoverage[i]-.35);
        STATE.sandedAmount[i]=Math.max(0,STATE.sandedAmount[i]-.15);
        removed+=before-STATE.radii[i];
      }
    }

    if(removed>.0002){
      const chipBurst = s.chisel.id==="roughing" ? 14 : s.chisel.id==="parting" ? 8 : 11;
      spawnChips(s,Math.min(chipBurst,2+Math.floor(removed*155)));
    }
  }

  function applySandpaperContact(s,dt){
    const paper=SANDPAPERS.find(p=>p.id===STATE.activeSandpaper) || SANDPAPERS[1];
    const w=contactWindow(s,s.contactWidthIn,1.12);
    const gritNorm=clamp((paper.grit-80)/(3000-80),0,1);
    const smooth=lerp(.25,.05,gritNorm);
    const remove=lerp(.0038,.00035,gritNorm);
    const snapshot=STATE.radii.slice(w.start,w.end+1);
    for(let i=w.start;i<=w.end;i++){
      const d=Math.abs((i-w.center)/w.half);
      if(d>1.12) continue;
      const inf=clamp(1-d/1.12,0,1);
      const local=i-w.start, a=Math.max(0,local-2), b=Math.min(snapshot.length-1,local+2);
      let sum=0,count=0; for(let j=a;j<=b;j++){sum+=snapshot[j];count++;}
      const avg=sum/Math.max(1,count);
      STATE.radii[i]=lerp(STATE.radii[i],avg,smooth*inf);
      STATE.radii[i]=Math.max(.12,STATE.radii[i]-remove*inf);
      STATE.sandedAmount[i]=clamp(STATE.sandedAmount[i]+.025*inf,0,1);
      STATE.finishCoverage[i]=Math.max(0,STATE.finishCoverage[i]-(1-gritNorm*.55)*.018*inf);
    }
    spawnDust(s,Math.max(2,Math.floor(3+(1-gritNorm)*4)));
  }

  function applyFinishContact(s,dt){
    const f=currentFinish();
    const w=contactWindow(s,s.contactWidthIn,1.05);
    const gain=f.kind==="Paint"?.075:.045;
    for(let i=w.start;i<=w.end;i++){
      const d=Math.abs((i-w.center)/w.half);
      if(d>1.05) continue;
      const inf=clamp(1-d/1.05,0,1);
      STATE.finishCoverage[i]=clamp(STATE.finishCoverage[i]+gain*inf,0,1);
      STATE.finishColor[i]=finishApplyColor();
      STATE.finishKind[i]=f.kind;
    }
    spawnFinishMarks(s,2);
  }

  function spawnDust(s,count){
    for(let i=0;i<count;i++) STATE.particles.push({type:"dust",x:s.tipX+(Math.random()-.5)*28,y:s.surfaceBottomY,vx:(Math.random()-.5)*40,vy:15+Math.random()*55,life:.3+Math.random()*.35,age:0,size:1+Math.random()*2,r:0,rot:0});
  }

  function spawnFinishMarks(s,count){
    for(let i=0;i<count;i++) STATE.particles.push({type:"finish",color:finishApplyColor(),x:s.tipX+(Math.random()-.5)*18,y:s.surfaceBottomY,vx:(Math.random()-.5)*16,vy:8+Math.random()*20,life:.2+Math.random()*.18,age:0,size:1.5+Math.random()*2,r:0,rot:0});
  }

  function spawnChips(s,count){
    for(let i=0;i<count;i++){
      STATE.particles.push({
        type:"chip",
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
    const raw=ctx.createLinearGradient(0,g.centerY-g.maxRadiusPx,0,g.centerY+g.maxRadiusPx);
    raw.addColorStop(0,"#855024");raw.addColorStop(.18,"#c47d38");raw.addColorStop(.40,"#e6aa65");raw.addColorStop(.52,"#f0bd7a");raw.addColorStop(.74,"#b86c2e");raw.addColorStop(1,"#74401d");
    ctx.fillStyle=raw;ctx.fill();

    // Local finish bands only where brush has actually touched.
    for(let i=0;i<STATE.samples-1;i++){
      const cov=STATE.finishCoverage[i]||0;
      if(cov<=.001) continue;
      const t0=i/(STATE.samples-1),t1=(i+1)/(STATE.samples-1);
      const x0=g.blankLeft+t0*g.blankLengthPx,x1=g.blankLeft+t1*g.blankLengthPx;
      const r=STATE.radii[i]*scale,top=g.centerY-r,bottom=g.centerY+r;
      const kind=STATE.finishKind[i], col=STATE.finishColor[i]||"#c89353";
      ctx.save();ctx.globalAlpha=kind==="Paint"?clamp(cov*1.05,0,1):clamp(cov*.72,0,.84);
      const grad=ctx.createLinearGradient(0,top,0,bottom);
      grad.addColorStop(0,shade(col,.13));grad.addColorStop(.48,col);grad.addColorStop(1,shade(col,-.15));
      ctx.fillStyle=grad;ctx.fillRect(x0-1,top,(x1-x0)+2,bottom-top);ctx.restore();
    }

    ctx.save();currentProfilePath(g);ctx.clip();
    const sweepY=g.centerY+Math.sin(STATE.rotation)*g.maxRadiusPx*.72;
    const shine=ctx.createLinearGradient(0,sweepY-25,0,sweepY+25);
    shine.addColorStop(0,"rgba(255,255,255,0)");shine.addColorStop(.48,"rgba(255,246,215,.38)");shine.addColorStop(.53,"rgba(255,255,255,.13)");shine.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=shine;ctx.fillRect(g.blankLeft,g.centerY-g.maxRadiusPx,g.blankLengthPx,g.maxRadiusPx*2);
    const yoff=(STATE.rotation*13)%14;ctx.globalAlpha=.22;ctx.strokeStyle="#6b3515";ctx.lineWidth=1.2;
    for(let y=g.centerY-g.maxRadiusPx-14+yoff;y<g.centerY+g.maxRadiusPx+14;y+=14){ctx.beginPath();ctx.moveTo(g.blankLeft,y);for(let j=1;j<=26;j++){const x=g.blankLeft+(j/26)*g.blankLengthPx;ctx.lineTo(x,y+Math.sin(j*.72+STATE.rotation*.33)*2);}ctx.stroke();}
    ctx.restore();

    // Bark remnants where uncut and not covered.
    ctx.save();
    for(let i=0;i<STATE.samples-1;i++){
      const opacity=clamp(1-STATE.cutAmount[i]/.045,0,1)*(1-(STATE.finishCoverage[i]||0));
      if(opacity<=0)continue;
      const t0=i/(STATE.samples-1),t1=(i+1)/(STATE.samples-1),x0=g.blankLeft+t0*g.blankLengthPx,x1=g.blankLeft+t1*g.blankLengthPx;
      const r=STATE.radii[i]*scale,top=g.centerY-r,bottom=g.centerY+r;
      ctx.globalAlpha=.28*opacity;ctx.fillStyle=Math.sin(STATE.rotation+i*.12)>0?"#6c351f":"#4e271b";ctx.fillRect(x0,top,x1-x0+1,bottom-top);
    }
    ctx.restore();

    ctx.strokeStyle="rgba(31,20,15,.76)";ctx.lineWidth=1.7;ctx.beginPath();
    for(let i=0;i<=180;i++){const t=i/180,x=g.blankLeft+t*g.blankLengthPx,y=g.centerY-targetRadius(t)*scale;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}for(let i=180;i>=0;i--){const t=i/180,x=g.blankLeft+t*g.blankLengthPx,y=g.centerY+targetRadius(t)*scale;ctx.lineTo(x,y);}ctx.closePath();ctx.stroke();
    ctx.save();ctx.translate(g.blankLeft,g.centerY);ctx.rotate(STATE.rotation);ctx.strokeStyle="rgba(54,25,10,.50)";ctx.lineWidth=1.3;for(let k=0;k<5;k++){const a=k*Math.PI*2/5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*5,Math.sin(a)*STATE.radii[0]*scale*.88);ctx.stroke();}ctx.restore();
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
      ctx.strokeStyle="rgba(182,255,69,.80)";
      ctx.lineWidth=2;
      rr(x-36,hy-62,72,110,10,null,"rgba(182,255,69,.80)",2);
    }
  }

  function drawSandpaperTool(){
    if(STATE.activeMode!=="SANDPAPER") return;
    const s=toolState();
    const paper=SANDPAPERS.find(p=>p.id===STATE.activeSandpaper)||SANDPAPERS[1];
    ctx.save();ctx.translate(s.handleX,s.handleY-18);
    const grad=ctx.createLinearGradient(-42,-20,42,20);grad.addColorStop(0,shade(paper.tone,.16));grad.addColorStop(1,shade(paper.tone,-.08));
    rr(-42,-20,84,40,7,grad,"#3e2419",1.7);
    ctx.fillStyle="rgba(255,255,255,.22)";for(let i=0;i<55;i++){const px=-29+Math.random()*58,py=-12+Math.random()*24;ctx.fillRect(px,py,1.2,1.2);}
    ctx.fillStyle="rgba(255,255,255,.88)";ctx.font="bold 11px Inter, Arial";ctx.textAlign="center";ctx.fillText(STATE.activeSandpaper,0,4);
    if(STATE.draggingTool) rr(-38,-20,76,40,8,null,"rgba(183,255,73,.78)",2);
    ctx.restore();
  }

  function drawBrushTool(){
    if(STATE.activeMode!=="FINISH") return;
    const s=toolState(), x=s.handleX, y=s.handleY, tipColor=finishApplyColor();
    ctx.save();ctx.translate(x,y);
    const hg=ctx.createLinearGradient(-13,18,13,94);hg.addColorStop(0,"#e9a75a");hg.addColorStop(.4,"#bc6d2e");hg.addColorStop(1,"#5c3016");rr(-11,18,22,74,8,hg,"#4a250f",1.3);
    const fg=ctx.createLinearGradient(-15,-3,15,14);fg.addColorStop(0,"#70767a");fg.addColorStop(.5,"#f2f4f4");fg.addColorStop(1,"#656b6f");rr(-15,-3,30,20,3,fg,"#50565a",1.2);
    const br=ctx.createLinearGradient(-15,-30,15,-5);br.addColorStop(0,shade(tipColor,.08));br.addColorStop(.55,tipColor);br.addColorStop(1,shade(tipColor,-.10));ctx.beginPath();ctx.moveTo(-15,-3);ctx.lineTo(-12,-30);ctx.lineTo(12,-30);ctx.lineTo(15,-3);ctx.closePath();ctx.fillStyle=br;ctx.fill();ctx.strokeStyle="#49311f";ctx.stroke();
    rr(-12,-34,24,7,3,tipColor,null);
    if(STATE.draggingTool) rr(-20,-39,40,136,10,null,"rgba(183,255,73,.78)",2);
    ctx.restore();
  }

  function drawParticles(){
    for(const p of STATE.particles){
      const a=clamp(1-p.age/p.life,0,1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot||0);ctx.globalAlpha=a;
      if(p.type==="dust"){ctx.fillStyle="rgba(225,205,177,.82)";ctx.beginPath();ctx.arc(0,0,p.size,0,Math.PI*2);ctx.fill();}
      else if(p.type==="finish"){ctx.fillStyle=p.color||"#c89353";ctx.beginPath();ctx.arc(0,0,p.size,0,Math.PI*2);ctx.fill();}
      else rr(-p.size/2,-1,p.size,2,1,"#ba6d32");
      ctx.restore();
    }
  }

  function draw(){
    const g=geometry();
    drawMachine(g);
    drawWood(g);
    drawParticles();
    drawChisel();
    drawSandpaperTool();
    drawBrushTool();
  }

  function localPointer(e){
    const r=canvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }

  function activeToolHit(x,y){
    const s=toolState();

    if(STATE.activeMode==="CHISEL"){
      // Grab is still handle-only in intent, but use a phone-friendly invisible
      // rectangle covering the wooden handle + ferrule. This avoids a tiny
      // ellipse becoming effectively untouchable on Android.
      const halfW=36;
      const top=s.handleY-62;
      const bottom=s.handleY+48;
      return Math.abs(x-s.handleX)<=halfW && y>=top && y<=bottom;
    }

    if(STATE.activeMode==="SANDPAPER"){
      return Math.abs(x-s.handleX)<=44 && Math.abs(y-(s.handleY-18))<=28;
    }

    if(STATE.activeMode==="FINISH"){
      return Math.abs(x-s.handleX)<=28 && y>=s.handleY-45 && y<=s.handleY+100;
    }

    return false;
  }

  function beginToolDrag(e){
    if(STATE.draggingTool) return false;

    const p=localPointer(e);
    if(!activeToolHit(p.x,p.y)) return false;

    const s=toolState();
    STATE.draggingTool=true;
    STATE.toolPointerId=e.pointerId;
    STATE.grabOffsetX=p.x-s.handleX;
    STATE.grabOffsetY=p.y-s.handleY;

    if(e.cancelable) e.preventDefault();

    try{
      canvas.setPointerCapture(e.pointerId);
    }catch(_err){
      // Window listeners below are the fallback on browsers that reject capture.
    }

    return true;
  }

  function moveToolDrag(e){
    if(!STATE.draggingTool || e.pointerId!==STATE.toolPointerId) return;

    const p=localPointer(e);
    const g=geometry();

    const desiredX=p.x-STATE.grabOffsetX;
    const desiredY=p.y-STATE.grabOffsetY;

    STATE.toolX=clamp((desiredX-g.blankLeft)/g.blankLengthPx,-0.035,1.035);

    if(STATE.activeMode==="CHISEL"){
      const minY=Math.max(g.centerY+18, g.h*.38);
      const maxY=Math.max(minY+34,g.h-18);
      STATE.desiredHandleY=clamp(desiredY,minY,maxY);
    }else if(STATE.activeMode==="SANDPAPER"){
      const minY=g.centerY+16;
      const maxY=Math.max(minY+26,g.h-18);
      STATE.desiredHandleY=clamp(desiredY,minY,maxY);
    }else{
      const minY=g.centerY+24;
      const maxY=Math.max(minY+30,g.h-82);
      STATE.desiredHandleY=clamp(desiredY,minY,maxY);
    }

    if(e.cancelable) e.preventDefault();
  }

  function endToolDrag(e){
    if(!STATE.draggingTool) return;
    if(e.pointerId!==undefined && e.pointerId!==STATE.toolPointerId) return;

    const pid=STATE.toolPointerId;
    STATE.draggingTool=false;
    STATE.toolPointerId=null;

    try{
      if(pid!==null && canvas.hasPointerCapture(pid)){
        canvas.releasePointerCapture(pid);
      }
    }catch(_err){}
  }

  canvas.addEventListener("pointerdown",beginToolDrag,{passive:false});
  canvas.addEventListener("pointermove",moveToolDrag,{passive:false});
  canvas.addEventListener("pointerup",endToolDrag,{passive:false});
  canvas.addEventListener("pointercancel",endToolDrag,{passive:false});

  // Android/browser fallback: if pointer capture is interrupted, keep the drag
  // alive from the window until the finger is released.
  window.addEventListener("pointermove",moveToolDrag,{passive:false});
  window.addEventListener("pointerup",endToolDrag,{passive:false});
  window.addEventListener("pointercancel",endToolDrag,{passive:false});

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
    els.modalBody.innerHTML=`
      <div class="visual-catalog sand-catalog">
        ${SANDPAPERS.map(item=>`
          <button class="visual-option sand-option ${item.id===STATE.activeSandpaper?"selected":""}"
                  data-sand="${item.id}" type="button">
            <span class="option-image sand-image illustration-card" style="--sand-tone:${item.tone};--sand-accent:${item.accent}">
              <i class="sand-sheet ${item.visual}">
                <span class="sheet-top"></span>
                <span class="sheet-fold"></span>
                <span class="sheet-label">${item.id}</span>
              </i>
            </span>
            <span class="option-copy">
              <strong>${item.id} — ${item.grit} Grit</strong>
              <small>${item.desc}</small>
            </span>
          </button>
        `).join("")}
      </div>`;

    els.modalBody.querySelectorAll("[data-sand]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        STATE.activeSandpaper=btn.dataset.sand;
        STATE.activeMode="SANDPAPER";
        placeActiveTool("SANDPAPER");
        updateLabels();
        closePopup();
      });
    });
  }

  function renderChiselPopup(){
    els.modalTitle.textContent="Chisels";
    els.modalBody.innerHTML=`
      <div class="visual-catalog chisel-catalog">
        ${CHISELS.map(c=>`
          <button class="visual-option chisel-option ${c.id===STATE.activeChisel?"selected":""}"
                  data-chisel="${c.id}" type="button">
            <span class="option-image chisel-image illustration-card">
              <i class="popup-chisel ${c.visual}">
                <span class="pc-metal"></span>
                <span class="pc-tip"></span>
                <span class="pc-ferrule"></span>
                <span class="pc-handle"></span>
              </i>
            </span>
            <span class="option-copy">
              <strong>${c.name}</strong>
              <small>${c.desc}</small>
              <em>Approx. cutter width: ${c.widthIn.toFixed(2)}"</em>
            </span>
          </button>
        `).join("")}
      </div>`;

    els.modalBody.querySelectorAll("[data-chisel]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        STATE.activeChisel=btn.dataset.chisel;
        STATE.activeMode="CHISEL";
        placeActiveTool("CHISEL");
        updateLabels();
        closePopup();
      });
    });
  }

  function renderFinishPopup(){
    els.modalTitle.textContent="Paint / Stain";
    els.modalBody.innerHTML=`
      <div class="visual-catalog finish-catalog">
        ${FINISHES.map(f=>{
          const bg = f.color.startsWith("linear-gradient")
            ? f.color
            : f.kind==="Stain"
              ? `linear-gradient(rgba(255,255,255,.08),rgba(35,15,6,.13)), repeating-linear-gradient(90deg,rgba(72,31,8,.20) 0 2px,transparent 2px 9px), ${f.color}`
              : f.color;
          return `
            <button class="visual-option finish-option ${f.id===STATE.activeFinish?"selected":""}"
                    data-finish="${f.id}" type="button">
              <span class="option-image finish-image ${f.kind.toLowerCase()}">
                <i class="finish-swatch" style="background:${bg}"></i>
                <b>${f.kind}</b>
              </span>
              <span class="option-copy">
                <strong>${f.id}</strong>
                <small>${f.desc}</small>
              </span>
            </button>`;
        }).join("")}
      </div>`;

    els.modalBody.querySelectorAll("[data-finish]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        STATE.activeFinish=btn.dataset.finish;
        STATE.activeMode="FINISH";
        placeActiveTool("FINISH");
        updateLabels();
        closePopup();
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
    const shownPos = clamp(STATE.toolX,0,1)*STATE.workLengthIn;
    els.positionReadout.textContent=`${shownPos.toFixed(1)}"`;
    els.diameterReadout.textContent=`${(radiusAt(STATE.toolX)*2).toFixed(2)}"`;
    els.activeSandLabel.textContent=STATE.activeSandpaper;
    els.activeChiselLabel.textContent=currentChisel().name;
    els.activeFinishLabel.textContent=STATE.activeFinish;
    updateSpeedVisual();

    // visible active cards
    document.querySelectorAll(".sand-card").forEach(c=>c.classList.remove("active"));
    const mainSandIds=["P120","P180","P220","P320","P400","P600","P800","P1000"];
    const sandCards=document.querySelectorAll(".sand-card");
    let sandIndex=mainSandIds.indexOf(STATE.activeSandpaper);
    if(sandIndex<0) sandIndex=0;
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

    applyActiveTool(dt);
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
