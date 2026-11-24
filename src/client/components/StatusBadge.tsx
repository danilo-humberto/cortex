import type { ConfidenceLevel, TopicStatus } from "../../shared/types.ts";
import { CONFIDENCE_META, STATUS_META, scoreColorClass } from "../lib/format.ts";

export function StatusBadge({ status }: { status: TopicStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreColorClass(score)}`}
    >
      {score}/10
    </span>
  );
}
