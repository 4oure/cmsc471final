let allDrives = [];
let currentDrive = null;
let currentStep = 0;

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
  sel.innerHTML = drives.map(d => {
    const driveKey = `${gameId}_${d.drive}`;
    const hasStory = storyNarratives[driveKey];
    const badge = hasStory ? "📖 " : "";
    return `<option value="${d.drive}">${badge}${d.posteam} Drive ${d.drive} — ${d.plays.length} plays — ${d.result}</option>`;
  }).join("");
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
  
  // Update story button and drive header with story indicator
  const driveKey = `${gameId}_${driveNum}`;
  const hasStory = storyNarratives[driveKey];
  const btn = document.getElementById("btn-story");
  if (hasStory) {
    btn.style.display = "block";
    btn.innerHTML = "<span style='animation: glow 1.5s infinite'>✨</span> 📖 Story Mode";
  } else {
    btn.style.display = "none";
  }
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
  const driveKey = `${d.game_id}_${d.drive}`;
  const hasStory = storyNarratives[driveKey];
  const badge = hasStory ? " <span style='color: #8b5cf6; font-size: 0.9em; margin-left: 0.5rem;'>[📖 Story Available]</span>" : "";
  document.getElementById("drive-title").innerHTML = `${d.posteam} — Drive ${d.drive}${badge}`;
  document.getElementById("drive-meta").textContent  =
    `${d.away_team} @ ${d.home_team} · Week ${d.week} · ${d.result}`;
  document.getElementById("empty-state").style.display  = "none";
  document.getElementById("play-card").style.display    = "block";
  document.getElementById("stat-row").style.display     = "grid";
  document.getElementById("metrics-info").style.display = "block";
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
