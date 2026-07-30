/**
 * Seed the Supabase claims table with synthetic test rows so the leaderboard
 * is populated for demos. Class identifiers only — never student PII.
 *
 * Usage: node scripts/seed-claims.mjs
 */
const URL = "https://qapzzjkkqsngghlknugl.supabase.co/rest/v1/claims";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcHp6amtrcXNuZ2dobGtudWdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY0OTgxNywiZXhwIjoyMTAwMjI1ODE3fQ.XXLfE51KayQKbExHNHeSHRW_cJM7f_-2KssZeaL44Wk";

function claim(teamId, teamLabel, show, score, activeSec, mag, players, hoursAgo) {
  const end = new Date(Date.now() - hoursAgo * 3600e3);
  const start = new Date(end.getTime() - activeSec * 1000);
  return {
    provider: "cameraPose",
    schema_version: 1,
    team_id: teamId,
    team_label: teamLabel,
    show,
    mode: "follow",
    input_profile: "standing",
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    active_seconds: activeSec,
    movement_magnitude: mag,
    team_score: score,
    gesture_counts: {
      jump: Math.round(score / 40),
      sidestep: Math.round(score / 60),
      duck: Math.round(score / 70),
      reach: Math.round(score / 55),
    },
    players_tracked: players,
  };
}

const rows = [
  claim("room-12", "Room 12", "tarapi-power-up", 1240, 58, 0.62, 18, 2),
  claim("room-7", "Room 7", "baseline", 1090, 52, 0.55, 15, 5),
  claim("9-blue", "9 Blue", "baseline", 980, 47, 0.51, 14, 9),
  claim("room-12", "Room 12", "grid", 870, 44, 0.48, 12, 26),
  claim("10-red", "10 Red", "baseline", 760, 41, 0.44, 11, 12),
  claim("room-3", "Room 3", "tarapi-power-up", 690, 38, 0.41, 10, 30),
  claim("room-15", "Room 15", "grid", 540, 33, 0.37, 9, 50),
  claim("8-green", "8 Green", "tarapi-power-up", 470, 29, 0.33, 8, 70),
  claim("room-5", "Room 5", "grid", 350, 25, 0.28, 7, 96),
  claim("room-9", "Room 9", "baseline", 220, 20, 0.22, 6, 120),
];

const res = await fetch(URL, {
  method: "POST",
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(rows),
});

if (!res.ok) {
  console.error("FAILED:", res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
console.log(`Seeded ${data.length} claims:`);
for (const r of data) console.log(`  ${r.team_label} — ${r.team_score} (${r.show})`);
