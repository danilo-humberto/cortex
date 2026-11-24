import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type {
  DashboardSummary,
  ModuleGroup,
  Topic,
} from "../shared/types.ts";
import {
  constantTimeStringEqual,
  createSessionToken,
  getSessionCookieName,
  getSessionTtlSeconds,
  verifySessionToken,
} from "./auth.ts";
import {
  createSql,
  ensureSchema,
  getTopicById,
  listAllTopics,
  listAttemptsByTopic,
  mapAttemptRow,
  mapTopicRow,
  seedRoadmapTopics,
  type DbRowAttempt,
  type DbRowTopic,
} from "./db.ts";
import {
  evaluateExplanationWithGemini,
  generatePracticeChallengeWithGemini,
} from "./gemini.ts";
import {
  buildTodayPlan,
  calculateNextReview,
  previewEasyIntervalDays,
} from "./srs.ts";
import type { WorkerEnv } from "./types.ts";

const app = new Hono<{ Bindings: WorkerEnv }>();

const loginBodySchema = z.object({
  accessKey: z.string().min(1, "Informe sua chave de acesso."),
});

const validateBodySchema = z.object({
  itemId: z.string().trim().min(1).optional(),
  explanation: z
    .string()
    .trim()
    .min(15, "Escreva pelo menos 15 caracteres com suas próprias palavras.")
    .max(8000, "A explicação excedeu o limite de 8.000 caracteres."),
});

const reviewBodySchema = z.object({
  itemId: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).max(8000),
  confidence: z.enum(["hard", "medium", "easy"]),
  evaluation: z.object({
    score: z.number().int().min(0).max(10),
    whatYouGotRight: z.array(z.string()),
    gapsOrMistakes: z.array(z.string()),
    followUpQuestion: z.string(),
    suggestedConfidence: z.enum(["hard", "medium", "easy"]).optional(),
  }),
});

const scheduleBodySchema = z.object({
  confidence: z.enum(["hard", "medium", "easy"]),
});

const practiceBodySchema = z.object({
  practiceDone: z.boolean(),
});

function isHttpsRequest(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return true;
  }
}

function groupByModule(topics: Topic[]): ModuleGroup[] {
  const map = new Map<number, ModuleGroup>();
  for (const topic of topics) {
    let group = map.get(topic.moduleOrder);
    if (!group) {
      group = {
        order: topic.moduleOrder,
        title: topic.moduleTitle,
        goal: topic.moduleGoal,
        topics: [],
      };
      map.set(topic.moduleOrder, group);
    }
    group.topics.push(topic);
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

app.onError((err, c) => {
  console.error(
    JSON.stringify({
      level: "error",
      path: c.req.path,
      method: c.req.method,
      message: err instanceof Error ? err.message : String(err),
    })
  );
  const message =
    err instanceof Error
      ? err.message
      : "Erro interno inesperado no servidor.";
  return c.json({ error: message }, 500);
});

app.get("/api/health", (c) => {
  return c.json({ ok: true, service: "cortex" });
});

app.get("/api/auth/me", async (c) => {
  const secret = c.env.SESSION_SECRET;
  const token = getCookie(c, getSessionCookieName());
  const authenticated = await verifySessionToken(token, secret);
  return c.json({ authenticated });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      400
    );
  }

  const expectedKey = c.env.APP_ACCESS_KEY;
  const sessionSecret = c.env.SESSION_SECRET;

  if (!expectedKey || !sessionSecret) {
    return c.json(
      {
        error:
          "Variáveis APP_ACCESS_KEY ou SESSION_SECRET não estão configuradas no ambiente.",
      },
      500
    );
  }

  const valid = await constantTimeStringEqual(
    parsed.data.accessKey,
    expectedKey
  );
  if (!valid) {
    return c.json({ error: "Chave de acesso incorreta." }, 401);
  }

  const token = await createSessionToken(sessionSecret);
  setCookie(c, getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttpsRequest(c.req.url),
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });

  return c.json({ authenticated: true });
});

app.post("/api/auth/logout", (c) => {
  deleteCookie(c, getSessionCookieName(), { path: "/" });
  return c.json({ authenticated: false });
});

// Middleware de autenticação para todas as rotas protegidas
app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  if (
    path === "/api/health" ||
    path === "/api/auth/me" ||
    path === "/api/auth/login" ||
    path === "/api/auth/logout"
  ) {
    return next();
  }

  const token = getCookie(c, getSessionCookieName());
  const authenticated = await verifySessionToken(token, c.env.SESSION_SECRET);
  if (!authenticated) {
    return c.json({ error: "Sessão expirada ou não autenticada." }, 401);
  }

  return next();
});

app.get("/api/dashboard", async (c) => {
  const sql = createSql(c.env.DATABASE_URL);
  const topics = await listAllTopics(sql);
  const today = buildTodayPlan(topics);

  const summary: DashboardSummary = {
    totalTopics: topics.length,
    startedCount: topics.filter((t) => t.status !== "not_started").length,
    masteredCount: topics.filter((t) => t.status === "mastered").length,
    practiceDoneCount: topics.filter((t) => t.practiceDone).length,
    dueReviewsCount: today.totalDueCount,
    overdueCount: today.overdueCount,
    dueReviews: today.dueReviews,
    nextNewTopic: today.nextNewTopic,
  };

  return c.json(summary);
});

app.get("/api/topics", async (c) => {
  const sql = createSql(c.env.DATABASE_URL);
  const topics = await listAllTopics(sql);
  return c.json({
    topics,
    modules: groupByModule(topics),
  });
});

app.get("/api/topics/:id", async (c) => {
  const id = c.req.param("id");
  const sql = createSql(c.env.DATABASE_URL);
  const topic = await getTopicById(sql, id);
  if (!topic) {
    return c.json({ error: "Tópico não encontrado." }, 404);
  }
  const attempts = await listAttemptsByTopic(sql, id);
  return c.json({
    topic,
    attempts,
    easyPreviewDays: previewEasyIntervalDays(topic.streak),
  });
});

app.post("/api/topics/:id/validate", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = validateBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Explicação inválida." },
      400
    );
  }

  const sql = createSql(c.env.DATABASE_URL);
  const topic = await getTopicById(sql, id);
  if (!topic) {
    return c.json({ error: "Tópico não encontrado." }, 404);
  }

  const studyItem = parsed.data.itemId
    ? topic.studyItems.find((item) => item.id === parsed.data.itemId)
    : undefined;

  if (parsed.data.itemId && !studyItem) {
    return c.json(
      { error: "Item de estudo não encontrado neste tópico." },
      404
    );
  }

  const evaluation = await evaluateExplanationWithGemini({
    apiKey: c.env.GEMINI_API_KEY,
    model: c.env.GEMINI_MODEL,
    topic,
    studyItem,
    explanation: parsed.data.explanation,
  });

  return c.json({ evaluation });
});

app.post("/api/topics/:id/review", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = reviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Dados da revisão inválidos." },
      400
    );
  }

  const sql = createSql(c.env.DATABASE_URL);
  const topic = await getTopicById(sql, id);
  if (!topic) {
    return c.json({ error: "Tópico não encontrado." }, 404);
  }

  const studyItem = parsed.data.itemId
    ? topic.studyItems.find((item) => item.id === parsed.data.itemId)
    : undefined;

  if (parsed.data.itemId && !studyItem) {
    return c.json(
      { error: "Item de estudo não encontrado neste tópico." },
      404
    );
  }

  const feedbackPayload = {
    whatYouGotRight: parsed.data.evaluation.whatYouGotRight,
    gapsOrMistakes: parsed.data.evaluation.gapsOrMistakes,
    followUpQuestion: parsed.data.evaluation.followUpQuestion,
  };

  const insertedAttempts = (await sql`
    INSERT INTO attempts (
      topic_id,
      item_id,
      item_title,
      user_explanation,
      ai_score,
      ai_feedback,
      confidence
    ) VALUES (
      ${topic.id},
      ${studyItem ? studyItem.id : null},
      ${studyItem ? studyItem.title : null},
      ${parsed.data.explanation},
      ${parsed.data.evaluation.score},
      ${JSON.stringify(feedbackPayload)}::jsonb,
      ${parsed.data.confidence}
    )
    RETURNING *
  `) as DbRowAttempt[];

  let updatedTopics: DbRowTopic[];

  if (studyItem) {
    // Salva progresso do item e recalcula a média das notas mais recentes por item do tópico,
    // sem avançar o streak do tópico a cada sub-item (o agendamento SRS do tópico ocorre no fechamento da sessão).
    const avgRows = (await sql`
      SELECT ROUND(AVG(latest.ai_score))::int AS avg_score
      FROM (
        SELECT DISTINCT ON (item_id) ai_score
        FROM attempts
        WHERE topic_id = ${topic.id}
          AND item_id IS NOT NULL
        ORDER BY item_id, created_at DESC
      ) AS latest
    `) as Array<{ avg_score: number | null }>;

    const avgScore =
      avgRows[0]?.avg_score !== null && avgRows[0]?.avg_score !== undefined
        ? Number(avgRows[0].avg_score)
        : parsed.data.evaluation.score;

    const nextStatus = topic.status === "not_started" ? "learning" : topic.status;

    updatedTopics = (await sql`
      UPDATE topics
      SET
        status = ${nextStatus},
        last_score = ${avgScore},
        updated_at = NOW()
      WHERE id = ${topic.id}
      RETURNING *
    `) as DbRowTopic[];
  } else {
    const srs = calculateNextReview(topic.streak, parsed.data.confidence);
    updatedTopics = (await sql`
      UPDATE topics
      SET
        status = ${srs.status},
        streak = ${srs.streak},
        interval_days = ${srs.intervalDays},
        next_review_at = ${srs.nextReviewAt.toISOString()},
        last_score = ${parsed.data.evaluation.score},
        updated_at = NOW()
      WHERE id = ${topic.id}
      RETURNING *
    `) as DbRowTopic[];
  }

  const updatedTopic = mapTopicRow(updatedTopics[0]);

  return c.json({
    topic: updatedTopic,
    attempt: mapAttemptRow(insertedAttempts[0]),
    easyPreviewDays: previewEasyIntervalDays(updatedTopic.streak),
  });
});

app.post("/api/topics/:id/schedule", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = scheduleBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Nível de confiança inválido para agendar revisão." },
      400
    );
  }

  const sql = createSql(c.env.DATABASE_URL);
  const topic = await getTopicById(sql, id);
  if (!topic) {
    return c.json({ error: "Tópico não encontrado." }, 404);
  }

  const srs = calculateNextReview(topic.streak, parsed.data.confidence);

  const updatedTopics = (await sql`
    UPDATE topics
    SET
      status = ${srs.status},
      streak = ${srs.streak},
      interval_days = ${srs.intervalDays},
      next_review_at = ${srs.nextReviewAt.toISOString()},
      updated_at = NOW()
    WHERE id = ${topic.id}
    RETURNING *
  `) as DbRowTopic[];

  const updatedTopic = mapTopicRow(updatedTopics[0]);

  return c.json({
    topic: updatedTopic,
    easyPreviewDays: previewEasyIntervalDays(updatedTopic.streak),
  });
});

app.patch("/api/topics/:id/practice", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = practiceBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Valor de prática inválido." }, 400);
  }

  const sql = createSql(c.env.DATABASE_URL);
  const existing = await getTopicById(sql, id);
  if (!existing) {
    return c.json({ error: "Tópico não encontrado." }, 404);
  }

  const updatedRows = (await sql`
    UPDATE topics
    SET
      practice_done = ${parsed.data.practiceDone},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as DbRowTopic[];

  return c.json({ topic: mapTopicRow(updatedRows[0]) });
});

app.post("/api/topics/:id/challenge", async (c) => {
  const id = c.req.param("id");
  const sql = createSql(c.env.DATABASE_URL);
  const topic = await getTopicById(sql, id);
  if (!topic) {
    return c.json({ error: "Tópico não encontrado." }, 404);
  }

  const challenge = await generatePracticeChallengeWithGemini({
    apiKey: c.env.GEMINI_API_KEY,
    model: c.env.GEMINI_MODEL,
    topic,
  });

  return c.json({ challenge });
});

app.post("/api/seed", async (c) => {
  const sql = createSql(c.env.DATABASE_URL);
  await ensureSchema(sql);
  const total = await seedRoadmapTopics(sql);
  return c.json({ ok: true, syncedTopics: total });
});

app.all("/api/*", (c) => {
  return c.json({ error: "Endpoint da API não encontrado." }, 404);
});

export default app;
