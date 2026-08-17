"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type DashboardListRow = {
  id: string;
  name: string;
  owner_id: string;
  owner_username: string;
  target_size: number;
  level_count: number;
};

export default function ListBrowser({
  lists,
  currentUserId,
}: {
  lists: DashboardListRow[];
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");

  const mine = useMemo(
    () => lists.filter((l) => l.owner_id === currentUserId),
    [lists, currentUserId],
  );

  const others = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lists.filter((l) => {
      if (l.owner_id === currentUserId) return false;
      if (!term) return true;
      return (
        l.name.toLowerCase().includes(term) ||
        l.owner_username.toLowerCase().includes(term)
      );
    });
  }, [lists, currentUserId, search]);

  return (
    <>
      <div className="section-title">Your Lists</div>
      {mine.length === 0 ? (
        <div className="empty-note">You haven&apos;t built a list yet.</div>
      ) : (
        mine.map((l) => <ListRow key={l.id} list={l} />)
      )}

      <div className="section-title">Search Lists</div>
      <input
        type="text"
        placeholder="Search by list name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div style={{ marginTop: "10px" }}>
        {others.length === 0 ? (
          <div className="empty-note">No matching lists found.</div>
        ) : (
          others.map((l) => <ListRow key={l.id} list={l} />)
        )}
      </div>
    </>
  );
}

function ListRow({ list }: { list: DashboardListRow }) {
  return (
    <Link className="list-row" href={`/lists/${list.id}`}>
      <div>
        <div className="lname">{list.name}</div>
        <div className="lmeta">
          by {list.owner_username} &middot; {list.level_count} / {list.target_size} levels
        </div>
      </div>
      <div className="icon-btn">&rarr;</div>
    </Link>
  );
}
