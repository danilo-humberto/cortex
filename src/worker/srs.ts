import type { ConfidenceLevel, Topic, TopicStatus } from "../shared/types.ts";

const EASY_PROGRESSION_DAYS = [7, 15, 30, 60] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SrsCalculation {
  status: TopicStatus;
  streak: number;
  intervalDays: number;
  nextReviewAt: Date;
}

/**
 * Calcula o próximo intervalo de revisão seguindo a especificação pedagógica:
 * - hard (Travei): +1 dia e reseta sequência (streak = 0)
 * - medium (Razoável): +3 dias (mantém streak atual)
 * - easy (Firme): avança streak e progride 7d -> 15d -> 30d -> 60d
 */
export function calculateNextReview(
  currentStreak: number,
  confidence: ConfidenceLevel,
  now: Date = new Date()
): SrsCalculation {
  if (confidence === "hard") {
    const intervalDays = 1;
    return {
      status: "learning",
      streak: 0,
      intervalDays,
      nextReviewAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
    };
  }

  if (confidence === "medium") {
    const intervalDays = 3;
    return {
      status: "reviewing",
      streak: Math.max(0, currentStreak),
      intervalDays,
      nextReviewAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
    };
  }

  // confidence === "easy"
  const nextStreak = Math.max(0, currentStreak) + 1;
  const idx = Math.min(nextStreak - 1, EASY_PROGRESSION_DAYS.length - 1);
  const intervalDays = EASY_PROGRESSION_DAYS[idx];
  const status: TopicStatus = nextStreak >= 3 ? "mastered" : "reviewing";

  return {
    status,
    streak: nextStreak,
    intervalDays,
    nextReviewAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
  };
}

/**
 * Retorna a prévia de quantos dias o botão "Firme" vai agendar com base no streak atual.
 */
export function previewEasyIntervalDays(currentStreak: number): number {
  const nextStreak = Math.max(0, currentStreak) + 1;
  const idx = Math.min(nextStreak - 1, EASY_PROGRESSION_DAYS.length - 1);
  return EASY_PROGRESSION_DAYS[idx];
}

export interface TodayPlan {
  dueReviews: Array<Topic & { overdueDays: number }>;
  totalDueCount: number;
  overdueCount: number;
  nextNewTopic: Topic | null;
}

/**
 * Monta o plano "Estudo de Hoje" com trava anti-bola de neve e prática intercalada (Interleaving):
 * - Até 2 revisões pendentes (nextReviewAt <= now), priorizando as mais atrasadas
 *   e alternando módulos na 2ª revisão quando possível.
 * - Até 1 próximo tópico novo (status === 'not_started') seguindo a ordem linear da trilha.
 */
export function buildTodayPlan(topics: Topic[], now: Date = new Date()): TodayPlan {
  const nowMs = now.getTime();

  const dueCandidates = topics
    .filter((topic) => {
      if (!topic.nextReviewAt) return false;
      return new Date(topic.nextReviewAt).getTime() <= nowMs;
    })
    .map((topic) => {
      const dueMs = new Date(topic.nextReviewAt!).getTime();
      const overdueDays = Math.max(0, Math.floor((nowMs - dueMs) / MS_PER_DAY));
      return { ...topic, overdueDays };
    })
    .sort((a, b) => {
      const diff =
        new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime();
      if (diff !== 0) return diff;
      return a.topicOrder - b.topicOrder;
    });

  const selectedReviews: Array<Topic & { overdueDays: number }> = [];

  if (dueCandidates.length > 0) {
    // 1ª revisão: sempre a mais atrasada
    const first = dueCandidates[0];
    selectedReviews.push(first);

    // 2ª revisão: tenta intercalar com outro módulo para praticar interleaving
    if (dueCandidates.length > 1) {
      const differentModuleCandidate = dueCandidates
        .slice(1)
        .find((candidate) => candidate.moduleOrder !== first.moduleOrder);

      selectedReviews.push(differentModuleCandidate ?? dueCandidates[1]);
    }
  }

  const nextNewTopic =
    [...topics]
      .filter((topic) => topic.status === "not_started")
      .sort((a, b) => {
        if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
        return a.topicOrder - b.topicOrder;
      })[0] ?? null;

  const overdueCount = dueCandidates.filter((t) => t.overdueDays >= 1).length;

  return {
    dueReviews: selectedReviews,
    totalDueCount: dueCandidates.length,
    overdueCount,
    nextNewTopic,
  };
}
