"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// True only after hydration — server HTML can't know the viewer's
// timezone, so anything timezone-dependent renders client-side only.
export function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function LocalTime({ iso, dateOnly }: { iso: string; dateOnly?: boolean }) {
  const isClient = useIsClient();
  if (!isClient) return <span>{iso.slice(0, 10)}</span>;
  return <span>{dateOnly ? formatDate(iso) : formatDateTime(iso)}</span>;
}
