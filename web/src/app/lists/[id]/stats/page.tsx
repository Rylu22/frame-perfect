import Link from "next/link";
import { notFound } from "next/navigation";
import { loadListPointsData } from "./data";
import Leaderboard from "./leaderboard";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadListPointsData(id);
  if (!data) notFound();

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={`/lists/${id}`}>
          &larr; back to list
        </Link>
        <h2 style={{ margin: "14px 0 18px" }}>Stats Viewer — {data.list.name}</h2>
        {data.standings.length === 0 ? (
          <div className="empty-note">No one has points on this list yet.</div>
        ) : (
          <Leaderboard listId={id} standings={data.standings} />
        )}
      </div>
    </div>
  );
}
