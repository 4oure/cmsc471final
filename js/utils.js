// ── UTILITY FUNCTIONS ──

function ordinal(n) {
  return n===1?"1st":n===2?"2nd":n===3?"3rd":n+"th";
}

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
