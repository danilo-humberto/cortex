import type { ConfidenceLevel, TopicStatus } from "../../shared/types.ts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const STATUS_META: Record<
  TopicStatus,
  { label: string; badgeClass: string }
> = {
  not_started: {
    label: "Não iniciado",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
  },
  learning: {
    label: "Aprendendo",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  reviewing: {
    label: "Revisando",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  mastered: {
    label: "Dominado",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
};

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; shortLabel: string; badgeClass: string }
> = {
  hard: {
    label: "Travei",
    shortLabel: "Travei (1d)",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  medium: {
    label: "Razoável",
    shortLabel: "Razoável (3d)",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  easy: {
    label: "Firme",
    shortLabel: "Firme (7d+)",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
};

export function formatNextReview(iso: string | null): {
  text: string;
  isDue: boolean;
} {
  if (!iso) {
    return { text: "Sem revisão agendada", isDue: false };
  }

  const target = new Date(iso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    const overdueDays = Math.floor(Math.abs(diffMs) / MS_PER_DAY);
    if (overdueDays === 0) {
      return { text: "Revisar hoje", isDue: true };
    }
    return {
      text: `Atrasada há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}`,
      isDue: true,
    };
  }

  const daysAhead = Math.ceil(diffMs / MS_PER_DAY);
  if (daysAhead === 1) {
    return { text: "Revisar amanhã", isDue: false };
  }
  return { text: `Em ${daysAhead} dias`, isDue: false };
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function scoreColorClass(score: number): string {
  if (score >= 8) return "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
  if (score >= 5) return "text-amber-300 bg-amber-500/15 border-amber-500/30";
  return "text-rose-300 bg-rose-500/15 border-rose-500/30";
}
