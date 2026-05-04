let allDrives = [];
let currentDrive = null;
let currentStep = 0;
const DURATION = 350;

// ── LOAD DATA ──
d3.json("data/pbp_2025.json").then(data => {
  allDrives = data;
  document.getElementById("loading").style.display = "none";
  document.getElementById("controls").style.display = "flex";
  document.getElementById("main").style.display = "grid";
  buildTeamSelect();
}).catch(err => {
  document.getElementById("loading").innerHTML =
    `<span style="color:#ef5350">Failed to load data. Make sure pbp_2025.json is in /data/.<br>${err}</span>`;
});

// ── DROPDOWNS ──
function buildTeamSelect() {
  const teams = [...new Set(allDrives.map(d => d.posteam))].sort();
  const sel = document.getElementById("sel-team");
  sel.innerHTML = '<option value="">All teams</option>' +
    teams.map(t => `<option value="${t}">${t}</option>`).join("");
  sel.addEventListener("change", buildWeekSelect);
  buildWeekSelect();
}
function buildWeekSelect() {
  const team = document.getElementById("sel-team").value;
  const filtered = team ? allDrives.filter(d => d.posteam === team) : allDrives;
  const weeks = [...new Set(filtered.map(d => d.week))].sort((a,b) => a-b);
  const sel = document.getElementById("sel-week");
  sel.innerHTML = weeks.map(w => `<option value="${w}">Week ${w}</option>`).join("");
  sel.addEventListener("change", buildGameSelect);
  buildGameSelect();
}
function buildGameSelect() {
  const team = document.getElementById("sel-team").value;
  const week = +document.getElementById("sel-week").value;
  const filtered = allDrives.filter(d => d.week === week && (!team || d.posteam === team));
  const games = [...new Map(filtered.map(d => [d.game_id, d])).values()];
  const sel = document.getElementById("sel-game");
  sel.innerHTML = games.map(d =>
    `<option value="${d.game_id}">${d.away_team} @ ${d.home_team}</option>`
  ).join("");
  sel.addEventListener("change", buildDriveSelect);
  buildDriveSelect();
}
function buildDriveSelect() {
  const team = document.getElementById("sel-team").value;
  const gameId = document.getElementById("sel-game").value;
  const drives = allDrives.filter(d => d.game_id === gameId && (!team || d.posteam === team));
  const sel = document.getElementById("sel-drive");
  sel.innerHTML = drives.map(d =>
    `<option value="${d.drive}">${d.posteam} Drive ${d.drive} — ${d.plays.length} plays — ${d.result}</option>`
  ).join("");
}

// ── LOAD DRIVE ──
document.getElementById("btn-load").addEventListener("click", () => {
  const gameId   = document.getElementById("sel-game").value;
  const driveNum = +document.getElementById("sel-drive").value;
  const team     = document.getElementById("sel-team").value;
  currentDrive   = allDrives.find(d =>
    d.game_id === gameId && d.drive === driveNum && (!team || d.posteam === team)
  );
  if (!currentDrive) return;
  currentStep = 0;
  renderDrive();
});

// ── KEYBOARD ──
document.addEventListener("keydown", e => {
  if (!currentDrive) return;
  if (e.key === "ArrowRight" && currentStep < currentDrive.plays.length - 1) { currentStep++; renderStep(); }
  if (e.key === "ArrowLeft"  && currentStep > 0) { currentStep--; renderStep(); }
});

// ── RENDER DRIVE ──
function renderDrive() {
  const d = currentDrive;
  document.getElementById("drive-title").textContent = `${d.posteam} — Drive ${d.drive}`;
  document.getElementById("drive-meta").textContent  =
    `${d.away_team} @ ${d.home_team} · Week ${d.week} · ${d.result}`;
  document.getElementById("empty-state").style.display  = "none";
  document.getElementById("play-card").style.display    = "block";
  document.getElementById("stat-row").style.display     = "grid";
  document.getElementById("charts-row").style.display   = "grid";
  buildScrubber();
  buildPlayLog();
  initField(); initEPA(); initWP();
  renderStep(false);
}

// ── SCRUBBER ──
function buildScrubber() {
  const wrap = document.getElementById("scrubber-wrap");
  const n = currentDrive.plays.length;
  wrap.innerHTML = `
    <div id="scrubber-labels">
      <span>Play 1</span>
      <span id="scrub-current">Play 1 of ${n}</span>
      <span>Play ${n}</span>
    </div>
    <div id="scrubber-track">
      <div id="scrubber-fill"></div>
      <div id="scrubber-thumb"></div>
      ${currentDrive.plays.map((p,i) => `
        <div class="scrub-tick${p.touchdown?' tick-td':p.interception?' tick-int':''}"
             style="left:${n>1?(i/(n-1))*100:0}%"
             data-index="${i}"></div>
      `).join("")}
    </div>
    <div id="scrubber-nav">
      <button class="nav-btn" id="nav-prev">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Prev
      </button>
      <span id="nav-hint">Use ← → arrow keys to step through</span>
      <button class="nav-btn primary" id="nav-next">
        Next
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;

  const track = document.getElementById("scrubber-track");
  function scrubTo(e) {
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx  = Math.round(pct * (n - 1));
    if (idx !== currentStep) { currentStep = idx; renderStep(); }
  }
  let dragging = false;
  track.addEventListener("mousedown", e => { dragging = true; scrubTo(e); });
  document.addEventListener("mousemove", e => { if (dragging) scrubTo(e); });
  document.addEventListener("mouseup",   () => { dragging = false; });

  track.querySelectorAll(".scrub-tick").forEach(tick => {
    tick.addEventListener("click", e => {
      e.stopPropagation();
      currentStep = +tick.dataset.index;
      renderStep();
    });
  });

  document.getElementById("nav-prev").addEventListener("click", () => {
    if (currentStep > 0) { currentStep--; renderStep(); }
  });
  document.getElementById("nav-next").addEventListener("click", () => {
    if (currentStep < currentDrive.plays.length - 1) { currentStep++; renderStep(); }
  });
}

function updateScrubber() {
  const n   = currentDrive.plays.length;
  const pct = n > 1 ? (currentStep / (n-1)) * 100 : 0;
  const fill  = document.getElementById("scrubber-fill");
  const thumb = document.getElementById("scrubber-thumb");
  const label = document.getElementById("scrub-current");
  if (fill)  fill.style.width = pct + "%";
  if (thumb) thumb.style.left = pct + "%";
  if (label) label.textContent = `Play ${currentStep+1} of ${n}`;
  const prev = document.getElementById("nav-prev");
  const next = document.getElementById("nav-next");
  if (prev) prev.disabled = currentStep === 0;
  if (next) next.disabled = currentStep === n - 1;
}

// ── PLAY LOG ──
function buildPlayLog() {
  const log = document.getElementById("play-log");
  log.innerHTML = "";
  currentDrive.plays.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "play-item" + (i > currentStep ? " future" : "");
    div.dataset.index = i;
    const epaColor  = p.epa === null ? "#555" : p.epa > 0 ? "#4caf50" : "#ef5350";
    const dotColor  = p.play_type === "pass" ? "#4a9eff" : p.play_type === "run" ? "#66aa66" : "#888";
    const dnLabel   = p.down ? `${p.down} & ${p.ydstogo}` : "—";
    const shortDesc = p.desc.length > 45 ? p.desc.slice(0, 45) + "…" : p.desc;
    const epaLabel  = p.epa !== null ? (p.epa > 0 ? "+" : "") + p.epa.toFixed(2) : "—";
    div.innerHTML = `
      <div class="play-dot" style="background:${dotColor}"></div>
      <span class="play-dn">${dnLabel}</span>
      <span class="play-desc-short">${shortDesc}</span>
      <span class="play-epa" style="color:${epaColor}">${epaLabel}</span>
    `;
    div.addEventListener("click", () => {
      if (i <= currentStep) { currentStep = i; renderStep(); }
    });
    log.appendChild(div);
  });
}

// ── RENDER STEP ──
function renderStep(animate = true) {
  const plays = currentDrive.plays;
  const p = plays[currentStep];

  document.querySelectorAll(".play-item").forEach((el, i) => {
    el.classList.toggle("active", i === currentStep);
    el.classList.toggle("future", i > currentStep);
  });
  const active = document.querySelector(".play-item.active");
  if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });

  updateScrubber();

  const qtrLabel = p.qtr ? `Q${p.qtr}` : "";
  const dnLabel  = p.down ? `${ordinal(p.down)} & ${p.ydstogo}` : "";
  const ylLabel  = p.yardline_100
    ? (p.yardline_100 <= 50 ? `OPP ${p.yardline_100}` : `OWN ${100-p.yardline_100}`)
    : "";
  document.getElementById("play-situation").textContent =
    [qtrLabel, dnLabel, ylLabel].filter(Boolean).join(" · ") +
    `  (Play ${currentStep+1} of ${plays.length})`;
  document.getElementById("play-description").textContent = p.desc;

  const tags = document.getElementById("play-tags");
  tags.innerHTML = "";
  if (p.play_type === "pass") tags.innerHTML += `<span class="tag tag-pass">Pass</span>`;
  if (p.play_type === "run")  tags.innerHTML += `<span class="tag tag-run">Run</span>`;
  if (p.touchdown)    tags.innerHTML += `<span class="tag tag-td">Touchdown</span>`;
  if (p.interception) tags.innerHTML += `<span class="tag tag-int">Interception</span>`;
  if (p.sack)         tags.innerHTML += `<span class="tag tag-sack">Sack</span>`;
  if (p.first_down)   tags.innerHTML += `<span class="tag tag-fd">First Down</span>`;

  const epaBox = document.getElementById("epa-explain");
  if (epaBox && p.epa !== null) {
    epaBox.textContent = explainEPA(p);
    epaBox.style.color = p.epa >= 0 ? "#4caf50" : "#ef5350";
  }

  const revealed = plays.slice(0, currentStep+1);
  const cumulEpa = revealed.reduce((s,pl) => s + (pl.epa || 0), 0);
  const cumulYds = revealed.reduce((s,pl) => s + (pl.yards_gained || 0), 0);
  document.getElementById("s-epa").textContent = (cumulEpa >= 0 ? "+" : "") + cumulEpa.toFixed(2);
  document.getElementById("s-epa").style.color = cumulEpa >= 0 ? "#4caf50" : "#ef5350";
  document.getElementById("s-yds").textContent = cumulYds.toFixed(0) + " yds";
  document.getElementById("s-wp").textContent  = p.wp !== null ? (p.wp*100).toFixed(0) + "%" : "—";
  document.getElementById("s-result").textContent = currentStep === plays.length-1
    ? currentDrive.result : "In progress…";

  updateField(animate);
  updateEPA(animate);
  updateWP(animate);
}

// ── EPA EXPLANATION ──
function explainEPA(p) {
  const sign = p.epa >= 0 ? "+" : "";
  const val  = `${sign}${p.epa.toFixed(2)} EPA`;
  if (p.touchdown)    return `${val} — Touchdown scored. Maximum gain in expected points.`;
  if (p.interception) return `${val} — Interception. Possession and scoring chance lost.`;
  if (p.sack)         return `${val} — Sack. Yardage loss puts scoring odds way back.`;
  const yds = p.yards_gained;
  if (p.play_type === "pass") {
    if (yds >= 20)        return `${val} — ${yds}-yd gain. Big play dramatically improves scoring odds.`;
    if (p.first_down)     return `${val} — ${yds} yds for a first down — drive stays alive.`;
    if (yds > 0)          return `${val} — ${yds}-yd gain, short of first down — tough situation ahead.`;
    if (yds === 0)        return `${val} — Incomplete pass. No gain; clock stops.`;
    return `${val} — Loss of ${Math.abs(yds)} yds on pass play.`;
  }
  if (p.play_type === "run") {
    if (yds >= 10)        return `${val} — ${yds}-yd run. Explosive gain shifts field position significantly.`;
    if (p.first_down)     return `${val} — ${yds} yds on the ground — good for a first down.`;
    if (yds > 0)          return `${val} — ${yds}-yd run, not enough for first down.`;
    if (yds === 0)        return `${val} — Stopped for no gain.`;
    return `${val} — Loss of ${Math.abs(yds)} yds — difficult down and distance ahead.`;
  }
  return `${val} — Change in expected points based on down, distance, and field position.`;
}

// ── FIELD ──
let fieldSvg, fieldG, fieldX;
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

// ── EPA ──
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

// ── WP ──
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

function ordinal(n) {
  return n===1?"1st":n===2?"2nd":n===3?"3rd":n+"th";
}