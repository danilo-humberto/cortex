import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  History,
  Lightbulb,
  ListChecks,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  Attempt,
  ConfidenceLevel,
  EvaluationResult,
  PracticeChallenge,
  StudyItem,
  Topic,
} from "../../shared/types.ts";
import {
  ConfidenceBadge,
  ScoreBadge,
  StatusBadge,
} from "../components/StatusBadge.tsx";
import { ApiError, api } from "../lib/api.ts";
import {
  CONFIDENCE_META,
  formatDateTime,
  formatNextReview,
  scoreColorClass,
} from "../lib/format.ts";

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function suggestConfidenceFromScore(score: number | null): ConfidenceLevel {
  if (score === null) return "medium";
  if (score <= 4) return "hard";
  if (score <= 7) return "medium";
  return "easy";
}

export function TopicStudyPage() {
  const { id } = useParams<{ id: string }>();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [easyPreviewDays, setEasyPreviewDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Recall: conceitos ocultos por padrão!
  const [showConcepts, setShowConcepts] = useState(false);

  // Estado independente por item de estudo (textarea + validação Gemini + feedback)
  const [explanationsByItem, setExplanationsByItem] = useState<
    Record<string, string>
  >({});
  const [validatingByItem, setValidatingByItem] = useState<
    Record<string, boolean>
  >({});
  const [savingByItem, setSavingByItem] = useState<Record<string, boolean>>({});
  const [errorByItem, setErrorByItem] = useState<Record<string, string | null>>(
    {}
  );
  const [savedMsgByItem, setSavedMsgByItem] = useState<
    Record<string, string | null>
  >({});
  const [evaluationByItem, setEvaluationByItem] = useState<
    Record<string, EvaluationResult | null>
  >({});
  const [revealedLastByItem, setRevealedLastByItem] = useState<
    Record<string, boolean>
  >({});

  // Agendamento SRS do tópico completo
  const [schedulingTopic, setSchedulingTopic] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState<string | null>(null);

  // Prática manual + Desafio Gerado por IA
  const [togglingPractice, setTogglingPractice] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [generatingChallenge, setGeneratingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<PracticeChallenge | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Histórico expansível
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (!id) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setExplanationsByItem({});
      setValidatingByItem({});
      setSavingByItem({});
      setErrorByItem({});
      setSavedMsgByItem({});
      setEvaluationByItem({});
      setRevealedLastByItem({});
      setScheduleError(null);
      setScheduleSavedMsg(null);
      setPracticeError(null);
      setChallenge(null);
      setShowConcepts(false);

      try {
        const res = await api.getTopicDetail(id!);
        if (!active) return;
        setTopic(res.topic);
        setAttempts(res.attempts);
        setEasyPreviewDays(res.easyPreviewDays);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof ApiError ? err.message : "Erro ao carregar tópico."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [id]);

  // Mapa da tentativa mais recente por itemId (attempts já vem ordenado DESC por createdAt)
  const latestAttemptByItem = useMemo(() => {
    const map = new Map<string, Attempt>();
    for (const attempt of attempts) {
      if (attempt.itemId && !map.has(attempt.itemId)) {
        map.set(attempt.itemId, attempt);
      }
    }
    return map;
  }, [attempts]);

  const completedItemsCount = useMemo(() => {
    if (!topic) return 0;
    return topic.studyItems.filter((item) => latestAttemptByItem.has(item.id))
      .length;
  }, [topic, latestAttemptByItem]);

  const averageItemsScore = useMemo(() => {
    if (!topic || completedItemsCount === 0) return null;
    let sum = 0;
    let count = 0;
    for (const item of topic.studyItems) {
      const latest = latestAttemptByItem.get(item.id);
      if (latest) {
        sum += latest.aiScore;
        count += 1;
      }
    }
    return count > 0 ? Math.round(sum / count) : null;
  }, [topic, completedItemsCount, latestAttemptByItem]);

  async function handleValidateItem(item: StudyItem) {
    if (!topic) return;
    const raw = explanationsByItem[item.id] ?? "";
    const trimmed = raw.trim();

    if (trimmed.length < 15) {
      setErrorByItem((prev) => ({
        ...prev,
        [item.id]:
          "Escreva pelo menos 15 caracteres explicando este item com suas próprias palavras.",
      }));
      return;
    }

    setValidatingByItem((prev) => ({ ...prev, [item.id]: true }));
    setErrorByItem((prev) => ({ ...prev, [item.id]: null }));
    setSavedMsgByItem((prev) => ({ ...prev, [item.id]: null }));

    try {
      const res = await api.validateExplanation(topic.id, trimmed, item.id);
      setEvaluationByItem((prev) => ({ ...prev, [item.id]: res.evaluation }));
    } catch (err) {
      setErrorByItem((prev) => ({
        ...prev,
        [item.id]:
          err instanceof ApiError
            ? err.message
            : "Falha ao consultar o Gemini. Tente novamente.",
      }));
    } finally {
      setValidatingByItem((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleSaveItemAttempt(
    item: StudyItem,
    confidence: ConfidenceLevel
  ) {
    if (!topic) return;
    const evaluation = evaluationByItem[item.id];
    const explanation = (explanationsByItem[item.id] ?? "").trim();
    if (!evaluation || !explanation) return;

    setSavingByItem((prev) => ({ ...prev, [item.id]: true }));
    setErrorByItem((prev) => ({ ...prev, [item.id]: null }));

    try {
      const res = await api.saveReview(topic.id, {
        itemId: item.id,
        explanation,
        evaluation,
        confidence,
      });
      setTopic(res.topic);
      setAttempts((prev) => [res.attempt, ...prev]);
      setEasyPreviewDays(res.easyPreviewDays);
      setEvaluationByItem((prev) => ({ ...prev, [item.id]: null }));
      setExplanationsByItem((prev) => ({ ...prev, [item.id]: "" }));
      setSavedMsgByItem((prev) => ({
        ...prev,
        [item.id]: `Item salvo no histórico com nota ${res.attempt.aiScore}/10 (${CONFIDENCE_META[confidence].label})!`,
      }));
    } catch (err) {
      setErrorByItem((prev) => ({
        ...prev,
        [item.id]:
          err instanceof ApiError
            ? err.message
            : "Não foi possível salvar a explicação deste item.",
      }));
    } finally {
      setSavingByItem((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleScheduleTopicReview(confidence: ConfidenceLevel) {
    if (!topic || schedulingTopic) return;
    setSchedulingTopic(true);
    setScheduleError(null);
    setScheduleSavedMsg(null);

    try {
      const res = await api.scheduleTopicReview(topic.id, confidence);
      setTopic(res.topic);
      setEasyPreviewDays(res.easyPreviewDays);
      setScheduleSavedMsg(
        `Revisão do tópico agendada (${CONFIDENCE_META[confidence].label})! Próxima revisão daqui a ${res.topic.intervalDays} ${res.topic.intervalDays === 1 ? "dia" : "dias"}.`
      );
    } catch (err) {
      setScheduleError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível agendar a próxima revisão do tópico."
      );
    } finally {
      setSchedulingTopic(false);
    }
  }

  async function handleTogglePractice() {
    if (!topic || togglingPractice) return;
    setTogglingPractice(true);
    setPracticeError(null);
    try {
      const res = await api.togglePractice(topic.id, !topic.practiceDone);
      setTopic(res.topic);
    } catch (err) {
      setPracticeError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atualizar o status da prática."
      );
    } finally {
      setTogglingPractice(false);
    }
  }

  async function handleGenerateChallenge() {
    if (!topic) return;
    setGeneratingChallenge(true);
    setChallengeError(null);
    setShowHint(false);
    setShowSolution(false);

    try {
      const res = await api.generateChallenge(topic.id);
      setChallenge(res.challenge);
    } catch (err) {
      setChallengeError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível gerar o desafio prático agora."
      );
    } finally {
      setGeneratingChallenge(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-400" />
        Preparando sala de estudo...
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="space-y-4">
        <Link
          to="/trilha"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a Trilha
        </Link>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-200 sm:p-6">
          {error ?? "Tópico não encontrado."}
        </div>
      </div>
    );
  }

  const reviewInfo = formatNextReview(topic.nextReviewAt);
  const totalItems = topic.studyItems.length;
  const itemsProgressPct =
    totalItems > 0 ? Math.round((completedItemsCount / totalItems) * 100) : 0;
  const suggestedTopicConfidence = suggestConfidenceFromScore(
    averageItemsScore ?? topic.lastScore
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Navegação superior */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Hoje
        </Link>
        <Link
          to="/trilha"
          className="inline-flex min-h-10 items-center text-xs font-medium text-indigo-400 hover:text-indigo-300"
        >
          Ver todos os tópicos
        </Link>
      </div>

      {/* Cabeçalho do Tópico */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="font-semibold text-indigo-300">
            Módulo {topic.moduleOrder}: {topic.moduleTitle}
          </span>
          <span>·</span>
          <span>Tópico #{topic.topicOrder}</span>
        </div>

        <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {topic.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {topic.summary}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={topic.status} />
          <ScoreBadge score={topic.lastScore} />
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-0.5 text-xs text-slate-300">
            <ListChecks className="h-3.5 w-3.5 text-indigo-400" />
            {completedItemsCount}/{totalItems} itens
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-0.5 text-xs text-slate-300">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            Sequência: {topic.streak}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
              reviewInfo.isDue
                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                : "border-slate-800 bg-slate-950/70 text-slate-400"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {reviewInfo.text}
          </span>
        </div>

        {/* Conceitos-chave escondidos por padrão (Active Recall) */}
        <div className="mt-4 border-t border-slate-800 pt-4 sm:mt-5">
          <button
            type="button"
            onClick={() => setShowConcepts((prev) => !prev)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-indigo-500/50 hover:text-white active:scale-[0.99] sm:min-h-9 sm:w-auto sm:rounded-lg sm:py-1.5"
          >
            {showConcepts ? (
              <>
                <EyeOff className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                Esconder conceitos-chave
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                Revelar conceitos-chave (sem colar antes!)
              </>
            )}
          </button>

          {showConcepts && (
            <div className="mt-3 flex flex-wrap gap-2">
              {topic.keyConcepts.map((concept) => (
                <span
                  key={concept}
                  className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-200"
                >
                  {concept}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bloco 1: Itens para pesquisar e explicar (Textarea por item + Validação Gemini) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              1. Pesquise e explique item por item
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              Pesquise cada ponto abaixo, feche as abas e explique com suas
              próprias palavras (Técnica de Feynman) no campo de cada item.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs font-semibold tabular-nums text-indigo-300">
              {completedItemsCount}/{totalItems} itens validados (
              {itemsProgressPct}%)
            </span>
          </div>
        </div>

        {/* Barra de progresso dos itens do tópico */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${itemsProgressPct}%` }}
          />
        </div>

        {/* Lista de cards por item */}
        <div className="mt-5 space-y-4">
          {topic.studyItems.map((item, idx) => {
            const latestAttempt = latestAttemptByItem.get(item.id);
            const value = explanationsByItem[item.id] ?? "";
            const words = countWords(value);
            const isValidating = Boolean(validatingByItem[item.id]);
            const isSaving = Boolean(savingByItem[item.id]);
            const itemError = errorByItem[item.id];
            const itemSavedMsg = savedMsgByItem[item.id];
            const evaluation = evaluationByItem[item.id];
            const showLast = Boolean(revealedLastByItem[item.id]);

            return (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 transition sm:p-5 ${
                  latestAttempt
                    ? "border-emerald-500/25 bg-slate-950/70"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                {/* Cabeçalho do item */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-2.5">
                    {latestAttempt ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          #{idx + 1}
                        </span>
                        <h3 className="text-sm font-semibold text-white sm:text-base">
                          {item.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        <span className="font-medium text-slate-300">
                          O que pesquisar:
                        </span>{" "}
                        {item.prompt}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-7 sm:pl-0">
                    {latestAttempt ? (
                      <>
                        <ScoreBadge score={latestAttempt.aiScore} />
                        <ConfidenceBadge
                          confidence={latestAttempt.confidence}
                        />
                      </>
                    ) : (
                      <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>

                {/* Ver última explicação salva (oculta por padrão para Active Recall) */}
                {latestAttempt && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedLastByItem((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-indigo-300"
                    >
                      {showLast ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Esconder última explicação salva
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Ver última explicação salva (
                          {formatDateTime(latestAttempt.createdAt)})
                        </>
                      )}
                    </button>

                    {showLast && (
                      <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-relaxed text-slate-300">
                        <p className="whitespace-pre-wrap">
                          {latestAttempt.userExplanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Textarea dedicada do item */}
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      htmlFor={`explanation-${item.id}`}
                      className="text-xs font-medium text-slate-300"
                    >
                      Sua explicação para este item:
                    </label>
                    <span className="text-[11px] tabular-nums text-slate-500">
                      {words} {words === 1 ? "palavra" : "palavras"}
                    </span>
                  </div>
                  <textarea
                    id={`explanation-${item.id}`}
                    rows={4}
                    value={value}
                    onChange={(e) =>
                      setExplanationsByItem((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    disabled={isValidating || isSaving}
                    placeholder={`Explique "${item.title}" com suas próprias palavras (sem cola): como funciona por baixo dos panos e onde isso aparece na prática?`}
                    className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-base leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 sm:p-3.5 sm:text-sm"
                  />
                </div>

                {itemError && (
                  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300 sm:text-sm">
                    {itemError}
                  </div>
                )}

                {itemSavedMsg && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200 sm:text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{itemSavedMsg}</span>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleValidateItem(item)}
                    disabled={isValidating || isSaving || value.trim().length < 5}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:w-auto sm:text-xs"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Avaliando item com Gemini...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Validar item com Gemini
                      </>
                    )}
                  </button>
                </div>

                {/* Feedback estruturado do Gemini para este item */}
                {evaluation && (
                  <div className="mt-4 space-y-4 rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          Avaliação do Gemini — {item.title}
                        </h4>
                        <p className="text-xs text-slate-400">
                          Confiança sugerida:{" "}
                          <span className="font-semibold text-slate-200">
                            {CONFIDENCE_META[evaluation.suggestedConfidence].label}
                          </span>
                        </p>
                      </div>
                      <div
                        className={`shrink-0 rounded-xl border px-3 py-1 text-sm font-bold tabular-nums sm:text-base ${scoreColorClass(evaluation.score)}`}
                      >
                        Nota {evaluation.score}/10
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                        <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />O que você
                          acertou
                        </h5>
                        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200 sm:text-sm">
                          {evaluation.whatYouGotRight.map((point, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-emerald-400">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                        <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Lacunas ou pontos para corrigir
                        </h5>
                        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200 sm:text-sm">
                          {evaluation.gapsOrMistakes.length > 0 ? (
                            evaluation.gapsOrMistakes.map((point, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-amber-400">•</span>
                                <span>{point}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-slate-300">
                              Nenhuma lacuna relevante encontrada!
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Pergunta desafiadora */}
                    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5">
                      <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                        <HelpCircle className="h-4 w-4 shrink-0" />
                        Pergunta desafiadora sobre este item
                      </h5>
                      <p className="mt-1.5 text-xs leading-relaxed text-indigo-100 sm:text-sm">
                        {evaluation.followUpQuestion}
                      </p>
                    </div>

                    {/* Confirmar e salvar tentativa deste item */}
                    <div className="border-t border-slate-800 pt-3.5">
                      <p className="mb-2.5 text-xs font-medium text-slate-300">
                        Salve este item no histórico indicando como você se
                        sentiu nele:
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            void handleSaveItemAttempt(item, "hard")
                          }
                          className={`flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition active:scale-[0.99] sm:text-sm ${
                            evaluation.suggestedConfidence === "hard"
                              ? "border-rose-400 bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/50"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                          }`}
                        >
                          Salvar · Travei
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            void handleSaveItemAttempt(item, "medium")
                          }
                          className={`flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition active:scale-[0.99] sm:text-sm ${
                            evaluation.suggestedConfidence === "medium"
                              ? "border-amber-400 bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/50"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                          }`}
                        >
                          Salvar · Razoável
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            void handleSaveItemAttempt(item, "easy")
                          }
                          className={`flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition active:scale-[0.99] sm:text-sm ${
                            evaluation.suggestedConfidence === "easy"
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/50"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                          }`}
                        >
                          Salvar · Firme
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Fechamento da Sessão: Agendar próxima revisão espaçada do tópico */}
        <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white sm:text-base">
                <CalendarClock className="h-4 w-4 text-indigo-400" />
                Concluir sessão e agendar próxima revisão do tópico
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                Quando terminar de revisar os itens de hoje, escolha sua
                confiança geral no tópico para atualizar a repetição espaçada.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-slate-300">
              <span>
                {completedItemsCount}/{totalItems} itens
              </span>
              {averageItemsScore !== null && (
                <>
                  <span>·</span>
                  <ScoreBadge score={averageItemsScore} />
                </>
              )}
            </div>
          </div>

          {scheduleError && (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
              {scheduleError}
            </div>
          )}

          {scheduleSavedMsg && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 sm:items-center">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400 sm:mt-0" />
              <span>{scheduleSavedMsg}</span>
            </div>
          )}

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              disabled={schedulingTopic}
              onClick={() => void handleScheduleTopicReview("hard")}
              className={`flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 transition active:scale-[0.99] disabled:opacity-60 sm:flex-col sm:justify-center sm:text-center ${
                completedItemsCount > 0 && suggestedTopicConfidence === "hard"
                  ? "border-rose-400 bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/50"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
              }`}
            >
              <span className="text-sm font-semibold">Travei</span>
              <span className="text-xs opacity-80 sm:mt-0.5">
                Revisar em +1 dia
              </span>
            </button>

            <button
              type="button"
              disabled={schedulingTopic}
              onClick={() => void handleScheduleTopicReview("medium")}
              className={`flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 transition active:scale-[0.99] disabled:opacity-60 sm:flex-col sm:justify-center sm:text-center ${
                completedItemsCount > 0 && suggestedTopicConfidence === "medium"
                  ? "border-amber-400 bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/50"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              }`}
            >
              <span className="text-sm font-semibold">Razoável</span>
              <span className="text-xs opacity-80 sm:mt-0.5">
                Revisar em +3 dias
              </span>
            </button>

            <button
              type="button"
              disabled={schedulingTopic}
              onClick={() => void handleScheduleTopicReview("easy")}
              className={`flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 transition active:scale-[0.99] disabled:opacity-60 sm:flex-col sm:justify-center sm:text-center ${
                completedItemsCount > 0 && suggestedTopicConfidence === "easy"
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/50"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              }`}
            >
              <span className="text-sm font-semibold">Firme</span>
              <span className="text-xs opacity-80 sm:mt-0.5">
                Revisar em +{easyPreviewDays} dias
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Bloco 2: Prática Manual + Desafio Caça ao Bug */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              2. Prática Manual (Contra o sedentarismo mental)
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {topic.suggestedPractice}
            </p>
          </div>

          <label className="inline-flex min-h-12 w-full shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-emerald-500/50 active:scale-[0.99] sm:min-h-11 sm:w-auto sm:justify-start">
            <input
              type="checkbox"
              checked={topic.practiceDone}
              disabled={togglingPractice}
              onChange={() => void handleTogglePractice()}
              className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 sm:h-4 sm:w-4"
            />
            <span>Fiz a prática manual</span>
          </label>
        </div>

        {practiceError && (
          <p className="mt-3 text-sm text-rose-300">{practiceError}</p>
        )}

        <div className="mt-4 border-t border-slate-800 pt-4">
          <button
            type="button"
            disabled={generatingChallenge}
            onClick={() => void handleGenerateChallenge()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 active:scale-[0.99] disabled:opacity-60 sm:w-auto"
          >
            {generatingChallenge ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando desafio de código...
              </>
            ) : (
              <>
                <Bug className="h-4 w-4 shrink-0" />
                <span>Gerar Desafio Prático (Caça ao Bug)</span>
              </>
            )}
          </button>

          {challengeError && (
            <p className="mt-3 text-sm text-rose-300">{challengeError}</p>
          )}

          {challenge && (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  {challenge.title}
                </h3>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] uppercase text-slate-300">
                  {challenge.language}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">
                {challenge.scenario}
              </p>

              <pre className="max-w-full overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/90 p-3.5 text-xs leading-relaxed text-slate-100 sm:p-4">
                <code>{challenge.code}</code>
              </pre>

              <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowHint((v) => !v)}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white active:scale-95"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                  {showHint ? "Esconder dica" : "Ver dica"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSolution((v) => !v)}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20 active:scale-95"
                >
                  {showSolution ? "Esconder gabarito" : "Revelar gabarito"}
                </button>
              </div>

              {showHint && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
                  <strong>Dica:</strong> {challenge.hint}
                </div>
              )}

              {showSolution && (
                <div className="whitespace-pre-wrap rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs leading-relaxed text-emerald-100">
                  <strong className="mb-1 block text-emerald-300">
                    Análise e Correção:
                  </strong>
                  {challenge.solution}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Bloco 3: Histórico de Tentativas (Caderno de Erros e Descobertas) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <History className="h-4 w-4 text-indigo-400" />
            Caderno de Tentativas ({attempts.length})
          </h2>
        </div>

        {attempts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Nenhuma tentativa salva ainda. Escreva a explicação de um dos itens
            acima para começar seu histórico!
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {attempts.map((attempt) => {
              const isOpen = expandedAttemptId === attempt.id;
              return (
                <div
                  key={attempt.id}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAttemptId(isOpen ? null : attempt.id)
                    }
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-900/70"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ScoreBadge score={attempt.aiScore} />
                      <ConfidenceBadge confidence={attempt.confidence} />
                      <span className="rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-200">
                        {attempt.itemTitle ?? "Tópico geral"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(attempt.createdAt)}
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="space-y-3 border-t border-slate-800 px-4 py-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Sua explicação
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-200">
                          {attempt.userExplanation}
                        </p>
                      </div>

                      {attempt.aiFeedback.gapsOrMistakes.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                            Pontos de melhoria anotados
                          </p>
                          <ul className="mt-1 space-y-1 text-xs text-slate-300">
                            {attempt.aiFeedback.gapsOrMistakes.map((g, i) => (
                              <li key={i}>• {g}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {attempt.aiFeedback.followUpQuestion && (
                        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs leading-relaxed text-indigo-200">
                          <strong>Follow-up:</strong>{" "}
                          {attempt.aiFeedback.followUpQuestion}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
