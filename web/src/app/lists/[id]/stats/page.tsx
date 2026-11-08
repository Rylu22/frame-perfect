import Link from "next/link";
import { notFound } from "next/navigation";
import TimeMachine from "@/components/time-machine";
import { parseAt, withAt } from "@/lib/time-machine";
import { loadListPointsData } from "./data";
import Leaderboard from "./leaderboard";

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const at = parseAt((await searchParams).at);
  const data = await loadListPointsData(id, at);
  if (!data) notFound();

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={withAt(`/lists/${id}`, at)}>
          &larr; back to list
        </Link>
        <TimeMachine
          at={at}
          trackingStart={data.timeMachine?.trackingStart ?? null}
          beforeTracking={data.timeMachine !== null && data.timeMachine.state === null}
        />
        <h2 style={{ margin: "14px 0 18px" }}>Stats Viewer — {data.list.name}</h2>
        {data.standings.length === 0 ? (
          <div className="empty-note">No one has points on this list{at ? " at that time" : " yet"}.</div>
        ) : (
          <Leaderboard listId={id} standings={data.standings} at={at} />
        )}
      </div>
    </div>
  );
}
