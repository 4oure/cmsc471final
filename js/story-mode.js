// ── STORY MODE NARRATIVES ──
const storyNarratives = {
  "2025_01_BAL_BUF_4": [
    { narrative: "The Ravens need to respond. Starting from their own 15-yard line, Baltimore faces a critical moment — establish the run game, control the line, and show they're a threat." },
    { narrative: "Derrick Henry bursts through the right guard for <span class='story-highlight'>11 yards</span>, immediately setting a physical tone. The power game is here." },
    { narrative: "After settling in, Jackson unleashes Zay Flowers deep down the right sideline for <span class='story-highlight'>20 yards</span>. Sudden, explosive, devastating." },
    { narrative: "The Ravens try to punch it up the middle with Henry. He gets <span class='story-highlight'>stuffed for 2 yards</span>. Buffalo's defense shows they can dig in." },
    { narrative: "Third-and-3: Jackson goes to Rashod Bateman underneath for <span class='story-highlight'>5 yards</span>. Smart football — not flashy, but the drive stays alive." },
    { narrative: "Facing third-and-3 again, Lamar Jackson scrambles for <span class='story-highlight'>17 yards</span> up the left sideline. MVP moment — creating his own magic." },
    { narrative: "Derrick Henry punches it in from 30 yards for a <span class='story-highlight'>TOUCHDOWN</span>. The kind of finish that changes a game." }
  ]
};

// ── STORY MODE EVENT HANDLERS ──
let storyStep = 0;

document.getElementById("btn-story").addEventListener("click", () => {
  if (!currentDrive) return;
  storyStep = 0;
  renderStoryMode();
  document.getElementById("story-modal").style.display = "block";
});

document.getElementById("story-close").addEventListener("click", () => {
  document.getElementById("story-modal").style.display = "none";
});

document.getElementById("story-prev").addEventListener("click", () => {
  if (storyStep > 0) { 
    const viewer = document.getElementById("story-play-viewer");
    viewer.style.opacity = "0";
    viewer.style.transform = "translateX(20px)";
    setTimeout(() => {
      storyStep--;
      renderStoryMode();
      viewer.style.opacity = "1";
      viewer.style.transform = "translateX(0)";
    }, 200);
  }
});

document.getElementById("story-next").addEventListener("click", () => {
  const plays = currentDrive.plays;
  if (storyStep < plays.length - 1) { 
    const viewer = document.getElementById("story-play-viewer");
    viewer.style.opacity = "0";
    viewer.style.transform = "translateX(-20px)";
    setTimeout(() => {
      storyStep++;
      renderStoryMode();
      viewer.style.opacity = "1";
      viewer.style.transform = "translateX(0)";
    }, 200);
  }
});

// ── STORY MODE RENDERING ──
function renderStoryMode() {
  const d = currentDrive;
  const plays = d.plays;
  const p = plays[storyStep];
  const driveKey = `${d.game_id}_${d.drive}`;
  const narratives = storyNarratives[driveKey];
  
  // Header
  document.getElementById("story-title").textContent = `${d.posteam} Drive ${d.drive}`;
  document.getElementById("story-meta").textContent = `${d.away_team} @ ${d.home_team} · Week ${d.week} · ${d.result}`;
  
  // Progress bar
  const pct = plays.length > 0 ? (storyStep / (plays.length - 1)) * 100 : 0;
  document.getElementById("story-progress").innerHTML = `<div id="story-progress-bar" style="width: ${pct}%"></div>`;
  
  // Play number and situation
  document.getElementById("story-play-number").textContent = `Play ${storyStep + 1} of ${plays.length}`;
  const qtr = p.qtr ? `Q${p.qtr}` : "";
  const dn = p.down ? `${ordinal(p.down)} & ${p.ydstogo}` : "";
  const yl = p.yardline_100 ? (p.yardline_100 <= 50 ? `OPP ${p.yardline_100}` : `OWN ${100-p.yardline_100}`) : "";
  document.getElementById("story-situation").textContent = [qtr, dn, yl].filter(Boolean).join(" · ");
  
  // Field visualization
  renderStoryField();
  
  // Narrative description
  let desc = narratives && narratives[storyStep] ? narratives[storyStep].narrative : p.desc;
  document.getElementById("story-description").innerHTML = desc;
  
  // EPA box
  const epaHtml = `
    <div class="epa-label">Expected Points Added</div>
    <div id="story-epa-value" class="${p.epa >= 0 ? 'positive' : 'negative'}">
      ${p.epa >= 0 ? '+' : ''}${p.epa.toFixed(2)}
    </div>
    <div id="story-epa-explain">${explainEPA(p)}</div>
  `;
  document.getElementById("story-epa-box").innerHTML = epaHtml;
  
  // Stats
  const revealed = plays.slice(0, storyStep + 1);
  const cumulEpa = revealed.reduce((s,pl) => s + (pl.epa || 0), 0);
  const cumulYds = revealed.reduce((s,pl) => s + (pl.yards_gained || 0), 0);
  document.getElementById("story-stats").innerHTML = `
    <div class="story-stat-item">
      <div class="story-stat-val" style="color: ${cumulEpa >= 0 ? '#4caf50' : '#ef5350'}">
        ${cumulEpa >= 0 ? '+' : ''}${cumulEpa.toFixed(2)}
      </div>
      <div class="story-stat-lbl">Cumulative EPA</div>
    </div>
    <div class="story-stat-item">
      <div class="story-stat-val">${cumulYds.toFixed(0)} yds</div>
      <div class="story-stat-lbl">Yards Gained</div>
    </div>
    <div class="story-stat-item">
      <div class="story-stat-val">${p.wp !== null ? (p.wp*100).toFixed(0) + '%' : '—'}</div>
      <div class="story-stat-lbl">Win Probability</div>
    </div>
    <div class="story-stat-item">
      <div class="story-stat-val" style="font-size: 0.9rem;">${p.play_type || '—'}</div>
      <div class="story-stat-lbl">Play Type</div>
    </div>
  `;
  
  // Navigation
  document.getElementById("story-prev").disabled = storyStep === 0;
  document.getElementById("story-next").disabled = storyStep === plays.length - 1;
  document.getElementById("story-counter").textContent = `${storyStep + 1} / ${plays.length}`;
}

function renderStoryField() {
  const plays = currentDrive.plays.slice(0, storyStep + 1);
  const field = document.getElementById("story-field");
  
  const svg = d3.select("#story-field").selectAll("svg").data([null]);
  svg.enter().append("svg").attr("width", "100%").attr("height", "120").attr("viewBox", "0 0 600 100").merge(svg).selectAll("*").remove();
  
  const s = d3.select("#story-field svg");
  s.append("rect").attr("x", 15).attr("y", 20).attr("width", 570).attr("height", 60)
    .attr("fill", "#0d1f0d").attr("stroke", "#1a3a1a").attr("stroke-width", 1);
  
  const x = d3.scaleLinear().domain([0, 100]).range([30, 585]);
  
  plays.forEach((p, i) => {
    if (p.yardline_100 === null) return;
    const px = x(100 - p.yardline_100);
    s.append("circle").attr("cx", px).attr("cy", 50).attr("r", i === plays.length - 1 ? 6 : 3)
      .attr("fill", i === plays.length - 1 ? "#4a9eff" : "#2a5a8a").attr("opacity", i === plays.length - 1 ? 1 : 0.6);
    
    if (i > 0 && plays[i-1].yardline_100 !== null) {
      const px2 = x(100 - plays[i-1].yardline_100);
      s.append("line").attr("x1", px2).attr("y1", 50).attr("x2", px).attr("y2", 50)
        .attr("stroke", "#2a6aaa").attr("stroke-width", 1.5).attr("opacity", 0.5);
    }
  });
}
