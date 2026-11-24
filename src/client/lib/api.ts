import type {
  Attempt,
  ConfidenceLevel,
  DashboardSummary,
  EvaluationResult,
  ModuleGroup,
  PracticeChallenge,
  Topic,
} from "../../shared/types.ts";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error ?? `Erro na requisição (${response.status}).`
    );
  }

  return data;
}

export const api = {
  authMe: () => request<{ authenticated: boolean }>("/api/auth/me"),

  login: (accessKey: string) =>
    request<{ authenticated: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ accessKey }),
    }),

  logout: () =>
    request<{ authenticated: boolean }>("/api/auth/logout", {
      method: "POST",
    }),

  getDashboard: () => request<DashboardSummary>("/api/dashboard"),

  getTopics: () =>
    request<{ topics: Topic[]; modules: ModuleGroup[] }>("/api/topics"),

  getTopicDetail: (id: string) =>
    request<{
      topic: Topic;
      attempts: Attempt[];
      easyPreviewDays: number;
    }>(`/api/topics/${encodeURIComponent(id)}`),

  validateExplanation: (id: string, explanation: string, itemId?: string) =>
    request<{ evaluation: EvaluationResult }>(
      `/api/topics/${encodeURIComponent(id)}/validate`,
      {
        method: "POST",
        body: JSON.stringify({ explanation, ...(itemId ? { itemId } : {}) }),
      }
    ),

  saveReview: (
    id: string,
    payload: {
      itemId?: string;
      explanation: string;
      evaluation: EvaluationResult;
      confidence: ConfidenceLevel;
    }
  ) =>
    request<{
      topic: Topic;
      attempt: Attempt;
      easyPreviewDays: number;
    }>(`/api/topics/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  scheduleTopicReview: (id: string, confidence: ConfidenceLevel) =>
    request<{
      topic: Topic;
      easyPreviewDays: number;
    }>(`/api/topics/${encodeURIComponent(id)}/schedule`, {
      method: "POST",
      body: JSON.stringify({ confidence }),
    }),

  togglePractice: (id: string, practiceDone: boolean) =>
    request<{ topic: Topic }>(`/api/topics/${encodeURIComponent(id)}/practice`, {
      method: "PATCH",
      body: JSON.stringify({ practiceDone }),
    }),

  generateChallenge: (id: string) =>
    request<{ challenge: PracticeChallenge }>(
      `/api/topics/${encodeURIComponent(id)}/challenge`,
      {
        method: "POST",
      }
    ),
};
