import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

interface ClaimRow {
  team_label: string;
  team_score: number;
  show: string;
  created_at: string;
}

interface LeaderEntry {
  team: string;
  score: number;
  show: string;
  when: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ onClose, compact }: { onClose?: () => void; compact?: boolean }): React.JSX.Element {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("claims")
        .select("team_label, team_score, show, created_at")
        .order("team_score", { ascending: false })
        .limit(60);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Best score per team (classes compete, so each class holds one slot).
      const best = new Map<string, LeaderEntry>();
      for (const row of (data ?? []) as ClaimRow[]) {
        const cur = best.get(row.team_label);
        if (!cur || row.team_score > cur.score) {
          best.set(row.team_label, {
            team: row.team_label,
            score: row.team_score,
            show: row.show,
            when: row.created_at,
          });
        }
      }
      const ranked = [...best.values()].sort((a, b) => b.score - a.score).slice(0, compact ? 5 : 15);
      setEntries(ranked);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [compact]);

  return (
    <div className="lb-panel">
      <style>{CSS}</style>
      <div className="lb-header">
        <div className="lb-title">Leaderboard</div>
        {onClose && (
          <button className="lb-close" onClick={onClose} aria-label="Close leaderboard">
            ✕
          </button>
        )}
      </div>
      <div className="lb-sub">Best score per class</div>

      {loading && <div className="lb-status">Loading scores…</div>}
      {error && <div className="lb-status lb-error">Couldn't load scores: {error}</div>}
      {!loading && !error && entries.length === 0 && (
        <div className="lb-status">No scores yet — play a session to get on the board!</div>
      )}

      <div className="lb-list">
        {entries.map((e, i) => (
          <div key={e.team} className={`lb-row ${i === 0 ? "lb-first" : ""}`}>
            <div className="lb-rank">{i < 3 ? MEDALS[i] : `${i + 1}`}</div>
            <div className="lb-team">{e.team}</div>
            <div className="lb-meta">
              <span className="lb-when">{timeAgo(e.when)}</span>
            </div>
            <div className="lb-score">{e.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
  .lb-panel {
    width: 100%;
    max-width: 520px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 20px;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: #fff;
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .lb-header { display: flex; align-items: center; justify-content: space-between; }
  .lb-title {
    font: bold clamp(24px, 6vw, 34px) system-ui;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #fff, #a78bfa);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .lb-close {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff;
    width: 40px; height: 40px;
    border-radius: 12px;
    font-size: 18px;
    cursor: pointer;
  }
  .lb-sub { font: 600 clamp(13px, 3vw, 15px) system-ui; color: rgba(255,255,255,0.4); margin: 4px 0 16px; }
  .lb-status { font: 600 clamp(14px, 3vw, 16px) system-ui; color: rgba(255,255,255,0.5); text-align: center; padding: 24px 0; }
  .lb-error { color: #ff8a8a; }
  .lb-list { display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow-y: auto; }
  .lb-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 12px 16px;
  }
  .lb-first {
    background: linear-gradient(135deg, rgba(255,212,0,0.15), rgba(255,212,0,0.05));
    border-color: rgba(255,212,0,0.4);
  }
  .lb-rank { font: bold clamp(18px, 4vw, 22px) system-ui; min-width: 36px; text-align: center; }
  .lb-team { flex: 1; font: bold clamp(16px, 4vw, 20px) system-ui; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lb-meta { display: flex; flex-direction: column; align-items: flex-end; }
  .lb-when { font: 600 clamp(11px, 2.5vw, 13px) system-ui; color: rgba(255,255,255,0.4); }
  .lb-score {
    font: bold clamp(20px, 5vw, 26px) system-ui;
    color: #00ffa3;
    min-width: 56px;
    text-align: right;
    text-shadow: 0 0 12px rgba(0,255,163,0.4);
  }
`;
