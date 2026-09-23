export default function RunBar({ start, end }: { start: number; end: number }) {
  const clampedStart = Math.max(0, Math.min(100, start));
  const clampedEnd = Math.max(0, Math.min(100, end));
  const width = Math.max(0, clampedEnd - clampedStart);

  return (
    <div className="run-bar-wrap">
      <div className="run-bar">
        <div className="run-bar-fill" style={{ left: `${clampedStart}%`, width: `${width}%` }} />
      </div>
      <span className="run-bar-label">
        {clampedStart}% &ndash; {clampedEnd}%
      </span>
    </div>
  );
}
