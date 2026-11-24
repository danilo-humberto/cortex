import { neon } from "@neondatabase/serverless";
import roadmapData from "../../data/roadmap.json" with { type: "json" };
import type {
  AiFeedback,
  Attempt,
  ConfidenceLevel,
  RoadmapJson,
  StudyItem,
  Topic,
  TopicStatus,
} from "../shared/types.ts";

export interface DbRowTopic {
  id: string;
  module_order: number;
  module_title: string;
  module_goal: string;
  topic_order: number;
  title: string;
  summary: string;
  key_concepts: string[] | string;
  study_items: StudyItem[] | string;
  suggested_practice: string;
  status: TopicStatus;
  streak: number;
  interval_days: number;
  next_review_at: string | Date | null;
  practice_done: boolean;
  last_score: number | null;
  updated_at: string | Date;
}

export interface DbRowAttempt {
  id: number;
  topic_id: string;
  item_id: string | null;
  item_title: string | null;
  user_explanation: string;
  ai_score: number;
  ai_feedback: AiFeedback | string;
  confidence: ConfidenceLevel;
  created_at: string | Date;
}

export type SqlClient = ReturnType<typeof neon>;

export function createSql(databaseUrl: string): SqlClient {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL não configurada. Configure a string de conexão do NeonDB."
    );
  }
  return neon(databaseUrl);
}

function toIsoString(value: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapTopicRow(row: DbRowTopic): Topic {
  const keyConcepts =
    typeof row.key_concepts === "string"
      ? (JSON.parse(row.key_concepts) as string[])
      : Array.isArray(row.key_concepts)
        ? row.key_concepts
        : [];

  const studyItems =
    typeof row.study_items === "string"
      ? (JSON.parse(row.study_items) as StudyItem[])
      : Array.isArray(row.study_items)
        ? row.study_items
        : [];

  return {
    id: row.id,
    moduleOrder: Number(row.module_order),
    moduleTitle: row.module_title,
    moduleGoal: row.module_goal ?? "",
    topicOrder: Number(row.topic_order),
    title: row.title,
    summary: row.summary,
    keyConcepts,
    studyItems,
    suggestedPractice: row.suggested_practice,
    status: row.status,
    streak: Number(row.streak),
    intervalDays: Number(row.interval_days),
    nextReviewAt: toIsoString(row.next_review_at),
    practiceDone: Boolean(row.practice_done),
    lastScore: row.last_score === null ? null : Number(row.last_score),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  };
}

export function mapAttemptRow(row: DbRowAttempt): Attempt {
  const aiFeedback =
    typeof row.ai_feedback === "string"
      ? (JSON.parse(row.ai_feedback) as AiFeedback)
      : row.ai_feedback;

  return {
    id: Number(row.id),
    topicId: row.topic_id,
    itemId: row.item_id ?? null,
    itemTitle: row.item_title ?? null,
    userExplanation: row.user_explanation,
    aiScore: Number(row.ai_score),
    aiFeedback: {
      whatYouGotRight: Array.isArray(aiFeedback?.whatYouGotRight)
        ? aiFeedback.whatYouGotRight
        : [],
      gapsOrMistakes: Array.isArray(aiFeedback?.gapsOrMistakes)
        ? aiFeedback.gapsOrMistakes
        : [],
      followUpQuestion: aiFeedback?.followUpQuestion ?? "",
    },
    confidence: row.confidence,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

/**
 * Cria as tabelas necessárias e aplica migrações idempotentes no NeonDB.
 */
export async function ensureSchema(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      module_order INT NOT NULL,
      module_title TEXT NOT NULL,
      module_goal TEXT NOT NULL DEFAULT '',
      topic_order INT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      key_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
      study_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      suggested_practice TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'learning', 'reviewing', 'mastered')),
      streak INT NOT NULL DEFAULT 0,
      interval_days INT NOT NULL DEFAULT 0,
      next_review_at TIMESTAMPTZ NULL,
      practice_done BOOLEAN NOT NULL DEFAULT FALSE,
      last_score INT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE topics
      ADD COLUMN IF NOT EXISTS study_items JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_topics_order
      ON topics (module_order, topic_order)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_topics_next_review
      ON topics (next_review_at)
      WHERE next_review_at IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attempts (
      id SERIAL PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      item_id TEXT NULL,
      item_title TEXT NULL,
      user_explanation TEXT NOT NULL,
      ai_score INT NOT NULL CHECK (ai_score >= 0 AND ai_score <= 10),
      ai_feedback JSONB NOT NULL,
      confidence TEXT NOT NULL CHECK (confidence IN ('hard', 'medium', 'easy')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE attempts
      ADD COLUMN IF NOT EXISTS item_id TEXT NULL
  `;

  await sql`
    ALTER TABLE attempts
      ADD COLUMN IF NOT EXISTS item_title TEXT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_attempts_topic_created
      ON attempts (topic_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_attempts_topic_item_created
      ON attempts (topic_id, item_id, created_at DESC)
  `;
}

/**
 * Sincroniza (UPSERT) os 30 tópicos e seus studyItems do data/roadmap.json para a tabela topics,
 * preservando o progresso de estudo (status, streak, next_review_at, practice_done, last_score).
 */
export async function seedRoadmapTopics(sql: SqlClient): Promise<number> {
  const roadmap = roadmapData as RoadmapJson;
  let count = 0;

  for (const mod of roadmap.modules) {
    for (const topic of mod.topics) {
      await sql`
        INSERT INTO topics (
          id,
          module_order,
          module_title,
          module_goal,
          topic_order,
          title,
          summary,
          key_concepts,
          study_items,
          suggested_practice
        ) VALUES (
          ${topic.id},
          ${mod.order},
          ${mod.title},
          ${mod.goal},
          ${topic.order},
          ${topic.title},
          ${topic.summary},
          ${JSON.stringify(topic.keyConcepts)}::jsonb,
          ${JSON.stringify(topic.studyItems)}::jsonb,
          ${topic.suggestedPractice}
        )
        ON CONFLICT (id) DO UPDATE SET
          module_order = EXCLUDED.module_order,
          module_title = EXCLUDED.module_title,
          module_goal = EXCLUDED.module_goal,
          topic_order = EXCLUDED.topic_order,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          key_concepts = EXCLUDED.key_concepts,
          study_items = EXCLUDED.study_items,
          suggested_practice = EXCLUDED.suggested_practice
      `;
      count += 1;
    }
  }

  return count;
}

/**
 * Garante schema + seed automático caso o banco esteja vazio ou ainda sem study_items populados.
 */
export async function ensureInitialized(sql: SqlClient): Promise<void> {
  await ensureSchema(sql);
  const existing = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE jsonb_array_length(study_items) = 0)::int AS missing_items
    FROM topics
  `) as Array<{
    total: number;
    missing_items: number;
  }>;
  if (
    !existing[0] ||
    Number(existing[0].total) === 0 ||
    Number(existing[0].missing_items) > 0
  ) {
    await seedRoadmapTopics(sql);
  }
}

export async function listAllTopics(sql: SqlClient): Promise<Topic[]> {
  await ensureInitialized(sql);
  const rows = (await sql`
    SELECT *
    FROM topics
    ORDER BY module_order ASC, topic_order ASC
  `) as DbRowTopic[];
  return rows.map(mapTopicRow);
}

export async function getTopicById(
  sql: SqlClient,
  id: string
): Promise<Topic | null> {
  await ensureInitialized(sql);
  const rows = (await sql`
    SELECT *
    FROM topics
    WHERE id = ${id}
    LIMIT 1
  `) as DbRowTopic[];
  return rows[0] ? mapTopicRow(rows[0]) : null;
}

export async function listAttemptsByTopic(
  sql: SqlClient,
  topicId: string
): Promise<Attempt[]> {
  const rows = (await sql`
    SELECT *
    FROM attempts
    WHERE topic_id = ${topicId}
    ORDER BY created_at DESC
    LIMIT 100
  `) as DbRowAttempt[];
  return rows.map(mapAttemptRow);
}
