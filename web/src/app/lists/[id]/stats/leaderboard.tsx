"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type StandingRow = { userId: string; username: string; points: number };

export default function Leaderboard({ listId, standings }: { listId: string; standings: StandingRow[] }) {
  const [search, setSearch] = useState("");

  const entries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return standings
      .map((s, i) => ({ ...s, rank: i + 1 }))
      .filter((s) => !term || s.username.toLowerCase().includes(term));
  }, [standings, search]);

  return (
    <>
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: "12px" }}
      />
      {entries.length === 0 ? (
        <div className="empty-note">No matching players.</div>
      ) : (
        entries.map((s) => (
          <Link className="points-row" key={s.userId} href={`/lists/${listId}/stats/${s.username}`}>
            <span className="pname">
              <span className="lg-rank" style={{ marginRight: "8px" }}>
                #{s.rank}
              </span>
              {s.username}
            </span>
            <span className="pval">{s.points.toFixed(2)} pts</span>
          </Link>
        ))
      )}
    </>
  );
}
