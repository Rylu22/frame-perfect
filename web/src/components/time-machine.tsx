"use client";

import { usePathname, useRouter } from "next/navigation";
import LocalTime, { useIsClient } from "./local-time";

function toLocalDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Date picker that puts the list, legacy list and stats pages into a
// read-only view of how they looked at the end of the chosen day (in the
// viewer's own timezone), via the ?at= search param.
export default function TimeMachine({
  at,
  trackingStart,
  beforeTracking,
}: {
  at: string | null;
  trackingStart: string | null;
  beforeTracking?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isClient = useIsClient();

  const today = isClient ? toLocalDateInput(new Date()) : undefined;
  const value = at && isClient ? toLocalDateInput(new Date(at)) : "";

  function pick(dateStr: string) {
    if (!dateStr || dateStr >= toLocalDateInput(new Date())) {
      router.push(pathname);
      return;
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
    router.push(`${pathname}?at=${encodeURIComponent(endOfDay.toISOString())}`);
  }

  return (
    <div className={`time-machine ${at ? "active" : ""}`}>
      <div className="tm-row">
        <span className="tm-label">&#9201; Time machine</span>
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => pick(e.target.value)}
          aria-label="View the list as of this date"
        />
        {at ? (
          <button className="mb-exit" type="button" onClick={() => router.push(pathname)}>
            Back to present
          </button>
        ) : (
          <span className="tm-hint">Pick a date to see the list as it was then.</span>
        )}
      </div>
      {at && (
        <div className="tm-hint">
          Viewing as of <LocalTime iso={at} /> — read only.
          {beforeTracking && trackingStart && (
            <>
              {" "}
              History for this list starts on <LocalTime iso={trackingStart} dateOnly />, so nothing earlier was
              recorded.
            </>
          )}
        </div>
      )}
    </div>
  );
}
