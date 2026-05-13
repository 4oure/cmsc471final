// ── FIELD VISUALIZATION ──
let fieldSvg, fieldG, fieldX;
const DURATION = 350;

function initField() {
  const el = document.getElementById("field-svg");
  const W = el.clientWidth || 520, H = 90;
  fieldX = d3.scaleLinear().domain([0, 100]).range([20, W-20]);
  fieldSvg = d3.select("#field-svg").attr("viewBox", `0 0 ${W} ${H}`);
  fieldSvg.selectAll("*").remove();
  fieldSvg.append("rect").attr("x",20).attr("y",10).attr("width",W-40).attr("height",60)
    .attr("fill","#0d1f0d").attr("rx",3).attr("stroke","#1a3a1a").attr("stroke-width",1);
  [10,20,30,40,50,60,70,80,90].forEach(yd => {
    fieldSvg.append("line").attr("x1",fieldX(yd)).attr("y1",10).attr("x2",fieldX(yd)).attr("y2",70)
      .attr("stroke","#1e3a1e").attr("stroke-width",0.5);
  });
  [10,20,30,40,50].forEach(yd => {
    const label = yd <= 50 ? yd : 100-yd;
    fieldSvg.append("text").attr("x",fieldX(yd)).attr("y",83)
      .attr("text-anchor","middle").attr("font-size",8).attr("fill","#2a5a2a").text(label);
    fieldSvg.append("text").attr("x",fieldX(100-yd)).attr("y",83)
      .attr("text-anchor","middle").attr("font-size",8).attr("fill","#2a5a2a").text(label);
  });
  fieldSvg.append("rect").attr("x",0).attr("y",10).attr("width",20).attr("height",60).attr("fill","#0a150a");
  fieldSvg.append("rect").attr("x",W-20).attr("y",10).attr("width",20).attr("height",60).attr("fill","#1a0a0a");
  fieldG = fieldSvg.append("g").attr("class","field-plays");
  fieldSvg.append("text").attr("id","field-pos-label").attr("y",7)
    .attr("text-anchor","middle").attr("font-size",9).attr("fill","#4a9eff");
}

function updateField(animate) {
  const plays = currentDrive.plays.slice(0, currentStep+1).filter(p => p.yardline_100 !== null);
  const yl2x  = yl => fieldX(100-yl);
  const dur   = animate ? DURATION : 0;
  fieldG.selectAll(".field-connector").remove();
  for (let i = 1; i < plays.length; i++) {
    fieldG.append("line").attr("class","field-connector")
      .attr("x1",yl2x(plays[i-1].yardline_100)).attr("y1",40)
      .attr("x2",yl2x(plays[i].yardline_100)).attr("y2",40)
      .attr("stroke","#2a6aaa").attr("stroke-width",1.5).attr("opacity",0.5);
  }
  const dots = fieldG.selectAll(".field-dot").data(plays, (d,i) => i);
  dots.enter().append("circle").attr("class","field-dot")
    .attr("cx", d => yl2x(d.yardline_100)).attr("cy",40).attr("r",0).attr("opacity",0)
    .merge(dots).transition().duration(dur).ease(d3.easeCubicOut)
    .attr("cx", d => yl2x(d.yardline_100))
    .attr("r",  (d,i) => i === plays.length-1 ? 7 : 4)
    .attr("fill",(d,i) => i === plays.length-1 ? "#4a9eff" : "#2a5a8a")
    .attr("opacity",(d,i) => i === plays.length-1 ? 1 : 0.6);
  dots.exit().transition().duration(dur).attr("r",0).remove();
  const last = plays[plays.length-1];
  if (last) {
    const yl = last.yardline_100;
    const label = yl===50 ? "50" : yl<50 ? `OPP ${yl}` : `OWN ${100-yl}`;
    fieldSvg.select("#field-pos-label").transition().duration(dur).ease(d3.easeCubicOut)
      .attr("x", yl2x(yl)).text(label);
  }
}

// ── EPA VISUALIZATION ──
let epaSvg, epaG, epaX, epaY, epaIW, epaIH;
const epaM = {t:12, r:10, b:20, l:36};

function initEPA() {
  const el = document.getElementById("epa-svg");
  const W = el.clientWidth || 260, H = el.clientHeight || 130;
  epaIW = W - epaM.l - epaM.r; epaIH = H - epaM.t - epaM.b;
  epaSvg = d3.select("#epa-svg").attr("viewBox",`0 0 ${W} ${H}`);
  epaSvg.selectAll("*").remove();
  epaG = epaSvg.append("g").attr("transform",`translate(${epaM.l},${epaM.t})`);
  epaG.append("line").attr("class","epa-axis-y").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",epaIH)
    .attr("stroke","#2a2a2a").attr("stroke-width",0.5);
  epaG.append("line").attr("class","epa-zero").attr("x1",0).attr("x2",epaIW)
    .attr("stroke","#333").attr("stroke-width",1);
  epaG.append("g").attr("class","epa-ylabels");
  epaG.append("g").attr("class","epa-tooltip");
}

function updateEPA(animate) {
  const plays    = currentDrive.plays;
  const allValid = plays.filter(p => p.epa !== null);
  if (!allValid.length) return;
  const dur = animate ? DURATION : 0;
  const ext = d3.extent(allValid, p => p.epa);
  const yPad = Math.max(0.8, (ext[1]-ext[0])*0.25);
  epaX = d3.scaleLinear().domain([0, Math.max(plays.length-1,1)]).range([0, epaIW]);
  epaY = d3.scaleLinear().domain([ext[0]-yPad, ext[1]+yPad]).range([epaIH, 0]);
  epaG.select(".epa-zero").transition().duration(dur).attr("y1",epaY(0)).attr("y2",epaY(0));
  const ticks = [-4,-3,-2,-1,0,1,2,3,4].filter(v => v >= ext[0]-yPad && v <= ext[1]+yPad);
  const yLabels = epaG.select(".epa-ylabels").selectAll("text").data(ticks);
  yLabels.enter().append("text").merge(yLabels)
    .attr("x",-4).attr("text-anchor","end").attr("font-size",8).attr("fill","#444")
    .transition().duration(dur).attr("y", v => epaY(v)+4).text(v => v>0?"+"+v:v);
  yLabels.exit().remove();
  const bw = Math.max(4, epaIW/plays.length - 2);
  const revData = plays.map((p,i) => ({...p,idx:i})).filter(p => p.idx <= currentStep && p.epa !== null);
  const bars = epaG.selectAll(".epa-bar").data(revData, d => d.idx);
  bars.enter().append("rect").attr("class","epa-bar")
    .attr("x", d => epaX(d.idx)-bw/2).attr("y",epaY(0)).attr("width",bw).attr("height",0).attr("rx",2)
    .attr("fill", d => d.epa>=0?"#4caf50":"#ef5350").attr("opacity",0.3)
    .merge(bars).transition().duration(dur).ease(d3.easeCubicOut)
    .attr("x", d => epaX(d.idx)-bw/2)
    .attr("y", d => d.epa>=0 ? epaY(d.epa) : epaY(0))
    .attr("height", d => Math.abs(epaY(d.epa)-epaY(0)))
    .attr("fill", d => d.epa>=0?"#4caf50":"#ef5350")
    .attr("opacity", d => d.idx===currentStep ? 1 : 0.35);
  bars.exit().transition().duration(dur).attr("height",0).attr("y",epaY(0)).remove();

  // callout on active bar
  const ap = plays[currentStep];
  const tip = epaG.select(".epa-tooltip");
  tip.selectAll("*").remove();
  if (ap && ap.epa !== null) {
    const cx = epaX(currentStep), cy = epaY(ap.epa);
    const above = ap.epa >= 0;
    const col = ap.epa >= 0 ? "#4caf50" : "#ef5350";
    tip.append("line").attr("x1",cx).attr("y1",above?cy-5:cy+5)
      .attr("x2",cx).attr("y2",above?cy-16:cy+16)
      .attr("stroke",col).attr("stroke-width",1.5);
    tip.append("circle").attr("cx",cx).attr("cy",cy).attr("r",5).attr("fill",col);
    tip.append("text").attr("x",cx).attr("y",above?cy-20:cy+26)
      .attr("text-anchor","middle").attr("font-size",9).attr("fill",col)
      .text((ap.epa>=0?"+":"")+ap.epa.toFixed(2));
  }
}

// ── WIN PROBABILITY VISUALIZATION ──
let wpSvg, wpG, wpX, wpY, wpIW, wpIH, wpPath, wpArea, wpDot;
const wpM = {t:10, r:10, b:20, l:36};

function initWP() {
  const el = document.getElementById("wp-svg");
  const W = el.clientWidth || 260, H = el.clientHeight || 130;
  wpIW = W-wpM.l-wpM.r; wpIH = H-wpM.t-wpM.b;
  wpX  = d3.scaleLinear().domain([0,1]).range([0,wpIW]);
  wpY  = d3.scaleLinear().domain([0,1]).range([wpIH,0]);
  wpSvg = d3.select("#wp-svg").attr("viewBox",`0 0 ${W} ${H}`);
  wpSvg.selectAll("*").remove();
  wpG = wpSvg.append("g").attr("transform",`translate(${wpM.l},${wpM.t})`);
  wpG.append("line").attr("x1",0).attr("y1",wpIH).attr("x2",wpIW).attr("y2",wpIH)
    .attr("stroke","#2a2a2a").attr("stroke-width",0.5);
  wpG.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",wpIH)
    .attr("stroke","#2a2a2a").attr("stroke-width",0.5);
  wpG.append("line").attr("x1",0).attr("y1",wpY(0.5)).attr("x2",wpIW).attr("y2",wpY(0.5))
    .attr("stroke","#2a2a2a").attr("stroke-width",1).attr("stroke-dasharray","3,3");
  [0, 0.5, 1].forEach(v => {
    wpG.append("text").attr("x",-4).attr("y",wpY(v)+4)
      .attr("text-anchor","end").attr("font-size",8).attr("fill","#444")
      .text((v*100).toFixed(0)+"%");
  });
  wpArea = wpG.append("path").attr("fill","#4a9eff").attr("opacity",0.08);
  wpPath = wpG.append("path").attr("fill","none").attr("stroke","#4a9eff").attr("stroke-width",1.5);
  wpDot  = wpG.append("circle").attr("r",4).attr("fill","#4a9eff");
}

function updateWP(animate) {
  const plays = currentDrive.plays;
  const rev   = plays.map((p,i) => ({...p,idx:i})).filter(p => p.idx <= currentStep && p.wp !== null);
  if (rev.length < 1) return;
  const dur = animate ? DURATION : 0;
  wpX = d3.scaleLinear().domain([0, plays.length-1]).range([0, wpIW]);
  const lineGen = d3.line().x(d => wpX(d.idx)).y(d => wpY(d.wp)).curve(d3.curveMonotoneX);
  const areaGen = d3.area().x(d => wpX(d.idx)).y0(wpIH).y1(d => wpY(d.wp)).curve(d3.curveMonotoneX);
  wpPath.transition().duration(dur).ease(d3.easeCubicOut).attr("d", lineGen(rev));
  wpArea.transition().duration(dur).ease(d3.easeCubicOut).attr("d", areaGen(rev));
  const last = rev[rev.length-1];
  wpDot.transition().duration(dur).ease(d3.easeCubicOut)
    .attr("cx", wpX(last.idx)).attr("cy", wpY(last.wp));
}
