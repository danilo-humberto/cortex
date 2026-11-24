import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Code2,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardSummary } from "../../shared/types.ts";
import { ScoreBadge, StatusBadge } from "../components/StatusBadge.tsx";
import { ApiError, api } from "../lib/api.ts";

export function TodayPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const summary = await api.getDashboard();
      setData(summary);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro ao carregar o estudo de hoje."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-400" />
        Carregando seu plano de hoje...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-200 sm:p-6">
        <p className="font-medium">Não foi possível carregar o painel.</p>
        <p className="mt-1 text-sm text-rose-300/90">{error}</p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-100 hover:bg-rose-500/30 sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const progressPct =
    data.totalTopics > 0
      ? Math.round((data.startedCount / data.totalTopics) * 100)
      : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Cabeçalho e Progresso Geral */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Estudo de Hoje
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm">
              Foco cirúrgico: até 2 revisões intercaladas + 1 tópico novo, sem
              bola de neve.
            </p>
          </div>
          <Link
            to="/trilha"
            className="hidden items-center gap-1.5 self-start rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-500/50 hover:text-white sm:inline-flex"
          >
            Ver trilha completa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Barra de Progresso */}
        <div className="mt-4 sm:mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
            <span>
              Progresso:{" "}
              <strong className="text-slate-200">
                {data.startedCount} / {data.totalTopics}
              </strong>{" "}
              iniciados
            </span>
            <span className="font-semibold text-indigo-300">{progressPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Métricas rápidas (2x2 no mobile, 4 colunas no desktop) */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 sm:text-xs">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
              <span className="truncate">Iniciados</span>
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-white sm:text-xl">
              {data.startedCount}
              <span className="text-xs font-normal text-slate-500 sm:text-sm">
                /{data.totalTopics}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 sm:text-xs">
              <Flame className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="truncate">Dominados</span>
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-emerald-300 sm:text-xl">
              {data.masteredCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 sm:text-xs">
              <Code2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="truncate">Práticas</span>
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-amber-300 sm:text-xl">
              {data.practiceDoneCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 sm:text-xs">
              <Clock className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span className="truncate">Revisões</span>
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-white sm:text-xl">
              {data.dueReviewsCount === 0 ? (
                <span className="text-base text-emerald-300 sm:text-xl">
                  Em dia
                </span>
              ) : (
                data.dueReviewsCount
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bloco 1: Revisões Pendentes (até 2 — Interleaving + trava anti-bola de neve) */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Revisões de Hoje
            </h2>
            <p className="text-xs text-slate-400">
              {data.dueReviewsCount > 2
                ? `Mostrando 2 de ${data.dueReviewsCount} revisões pendentes (trava anti-bola de neve + módulos intercalados).`
                : "Recuperação ativa no momento certo antes do esquecimento."}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-slate-300">
            {data.dueReviews.length} / 2
          </span>
        </div>

        {data.dueReviews.length === 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200 sm:items-center sm:p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400 sm:mt-0" />
            <div>
              <p className="font-medium">Revisões 100% em dia!</p>
              <p className="text-xs text-emerald-300/80">
                Nenhuma revisão vencida agora. Aproveite para avançar no próximo
                tópico novo abaixo.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.dueReviews.map((topic) => (
              <Link
                key={topic.id}
                to={`/topico/${topic.id}`}
                className="group flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-slate-900/80 p-4 transition hover:border-amber-400/60 hover:bg-slate-900 active:scale-[0.99] sm:p-5"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-indigo-300">
                      Módulo {topic.moduleOrder} · Tópico #{topic.topicOrder}
                    </span>
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      {topic.overdueDays > 0
                        ? `Atrasada ${topic.overdueDays}d`
                        : "Revisar hoje"}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-white group-hover:text-indigo-200 sm:text-lg">
                    {topic.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">
                    {topic.summary}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={topic.status} />
                    <ScoreBadge score={topic.lastScore} />
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-300 transition group-hover:translate-x-0.5">
                    Revisar
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Bloco 2: Próximo Tópico Novo */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Próximo Tópico Novo
            </h2>
            <p className="text-xs text-slate-400">
              1 passo atômico por sessão para construir base sólida sem pressa.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
            Trilha Linear
          </span>
        </div>

        {data.nextNewTopic ? (
          <Link
            to={`/topico/${data.nextNewTopic.id}`}
            className="group block rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-900 p-4 transition hover:border-indigo-400/60 active:scale-[0.99] sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Módulo {data.nextNewTopic.moduleOrder}:{" "}
                  {data.nextNewTopic.moduleTitle}
                </span>
              </span>
              <span className="text-xs text-slate-400">
                Tópico {data.nextNewTopic.topicOrder} de {data.totalTopics}
              </span>
            </div>

            <h3 className="mt-2.5 text-lg font-bold text-white group-hover:text-indigo-200 sm:text-xl">
              {data.nextNewTopic.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              {data.nextNewTopic.summary}
            </p>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-slate-400">
                Prática sugerida:{" "}
                <span className="text-slate-300">
                  {data.nextNewTopic.suggestedPractice}
                </span>
              </p>
              <span className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-indigo-500 sm:w-auto">
                Estudar tópico
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center sm:p-6">
            <p className="text-base font-semibold text-emerald-200">
              Você já iniciou todos os {data.totalTopics} tópicos do Cortex!
            </p>
            <p className="mt-1 text-sm text-emerald-300/80">
              Continue mantendo suas revisões espaçadas em dia para consolidar o
              domínio de longo prazo.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
