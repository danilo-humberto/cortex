import { describe, expect, it } from "vitest";
import type { Topic } from "../src/shared/types.ts";
import {
  buildTodayPlan,
  calculateNextReview,
  previewEasyIntervalDays,
} from "../src/worker/srs.ts";

function makeTopic(overrides: Partial<Topic>): Topic {
  return {
    id: "m1-t1",
    moduleOrder: 1,
    moduleTitle: "Módulo 1",
    moduleGoal: "",
    topicOrder: 1,
    title: "Tópico Exemplo",
    summary: "Resumo",
    keyConcepts: [],
    studyItems: [],
    suggestedPractice: "Prática",
    status: "not_started",
    streak: 0,
    intervalDays: 0,
    nextReviewAt: null,
    practiceDone: false,
    lastScore: null,
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateNextReview (Repetição Espaçada)", () => {
  const now = new Date("2026-11-23T20:00:00.000Z");

  it("hard (Travei) agenda +1 dia e reseta streak", () => {
    const res = calculateNextReview(3, "hard", now);
    expect(res.intervalDays).toBe(1);
    expect(res.streak).toBe(0);
    expect(res.status).toBe("learning");
    expect(res.nextReviewAt.toISOString()).toBe("2026-11-24T20:00:00.000Z");
  });

  it("medium (Razoável) agenda +3 dias mantendo streak", () => {
    const res = calculateNextReview(2, "medium", now);
    expect(res.intervalDays).toBe(3);
    expect(res.streak).toBe(2);
    expect(res.status).toBe("reviewing");
    expect(res.nextReviewAt.toISOString()).toBe("2026-11-26T20:00:00.000Z");
  });

  it("easy (Firme) segue progressão 7d -> 15d -> 30d -> 60d", () => {
    const step1 = calculateNextReview(0, "easy", now);
    expect(step1.streak).toBe(1);
    expect(step1.intervalDays).toBe(7);
    expect(step1.status).toBe("reviewing");

    const step2 = calculateNextReview(step1.streak, "easy", now);
    expect(step2.streak).toBe(2);
    expect(step2.intervalDays).toBe(15);
    expect(step2.status).toBe("reviewing");

    const step3 = calculateNextReview(step2.streak, "easy", now);
    expect(step3.streak).toBe(3);
    expect(step3.intervalDays).toBe(30);
    expect(step3.status).toBe("mastered");

    const step4 = calculateNextReview(step3.streak, "easy", now);
    expect(step4.streak).toBe(4);
    expect(step4.intervalDays).toBe(60);
    expect(step4.status).toBe("mastered");

    const step5 = calculateNextReview(step4.streak, "easy", now);
    expect(step5.intervalDays).toBe(60);
  });

  it("previewEasyIntervalDays reflete o próximo intervalo corretamente", () => {
    expect(previewEasyIntervalDays(0)).toBe(7);
    expect(previewEasyIntervalDays(1)).toBe(15);
    expect(previewEasyIntervalDays(2)).toBe(30);
    expect(previewEasyIntervalDays(3)).toBe(60);
  });
});

describe("buildTodayPlan (Interleaving + Trava anti-bola de neve)", () => {
  const now = new Date("2026-11-23T20:00:00.000Z");

  it("limita a 2 revisões pendentes e intercala módulos quando possível", () => {
    const topics: Topic[] = [
      makeTopic({
        id: "m1-t1",
        moduleOrder: 1,
        topicOrder: 1,
        status: "reviewing",
        nextReviewAt: "2026-11-18T20:00:00.000Z", // 5 dias atrasado
      }),
      makeTopic({
        id: "m1-t2",
        moduleOrder: 1,
        topicOrder: 2,
        status: "reviewing",
        nextReviewAt: "2026-11-19T20:00:00.000Z", // 4 dias atrasado (mesmo módulo 1)
      }),
      makeTopic({
        id: "m2-t1",
        moduleOrder: 2,
        topicOrder: 7,
        status: "reviewing",
        nextReviewAt: "2026-11-21T20:00:00.000Z", // 2 dias atrasado (módulo 2!)
      }),
      makeTopic({
        id: "m3-t1",
        moduleOrder: 3,
        topicOrder: 12,
        status: "not_started",
      }),
      makeTopic({
        id: "m1-t3",
        moduleOrder: 1,
        topicOrder: 3,
        status: "not_started",
      }),
    ];

    const plan = buildTodayPlan(topics, now);

    expect(plan.totalDueCount).toBe(3);
    expect(plan.dueReviews).toHaveLength(2);
    expect(plan.dueReviews[0].id).toBe("m1-t1");
    // A 2ª revisão escolhe o módulo 2 (interleaving) em vez do segundo tópico do módulo 1
    expect(plan.dueReviews[1].id).toBe("m2-t1");
    // Próximo tópico novo segue a trilha linear (m1-t3 antes de m3-t1)
    expect(plan.nextNewTopic?.id).toBe("m1-t3");
  });
});
