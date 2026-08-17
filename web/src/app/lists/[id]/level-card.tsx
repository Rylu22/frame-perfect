import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { tierByKey } from "@/lib/tiers";

export type LevelCardData = {
  id: string;
  name: string;
  difficulty: string;
  verifier_username: string | null;
  publisher: string | null;
  points: number;
  image_url: string | null;
  victor_count: number;
};

export default function LevelCard({
  level,
  index,
  actions,
  cardProps,
}: {
  level: LevelCardData;
  index: number;
  actions?: ReactNode;
  cardProps?: HTMLAttributes<HTMLDivElement>;
}) {
  const tier = tierByKey(level.difficulty);
  const { className: extraClassName, ...restCardProps } = cardProps ?? {};

  return (
    <div className={`level-card ${extraClassName ?? ""}`.trim()} {...restCardProps}>
      <div className="pos-badge">
        <span>{index + 1}</span>
      </div>
      {level.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- image_url is a locally-generated data URI, not a remote asset
        <img className="lv-thumb" src={level.image_url} alt="" />
      ) : (
        <div className="lv-thumb" />
      )}
      <div className="lv-info">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="lv-name">{level.name}</span>
          {tier && (
            <span className="tier-tag" style={{ "--tier": tier.color } as CSSProperties}>
              {tier.label}
            </span>
          )}
          <span className="victor-count">
            {level.victor_count} victor{level.victor_count === 1 ? "" : "s"}
          </span>
        </div>
        <div className="lv-meta">
          Verified by {level.verifier_username ?? "—"} &middot; Published by{" "}
          {level.publisher || "—"} &middot; {level.points.toFixed(2)} pts
        </div>
      </div>
      {actions && <div className="lv-actions">{actions}</div>}
    </div>
  );
}
