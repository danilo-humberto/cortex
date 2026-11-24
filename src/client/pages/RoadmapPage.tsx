import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ModuleGroup, TopicStatus } from "../../shared/types.ts";
import { ScoreBadge, StatusBadge } from "../components/StatusBadge.tsx";
import { ApiError, api } from "../lib/api.ts";
import { formatNextReview } from "../lib/format.ts";

type FilterValue = "all" | "due" | TopicStatus;

export function RoadmapPage() {
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await api.getTopics();
        if (active) setModules(res.modules);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Erro ao carregar a trilha completa."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();

    return modules
      .map((mod) => {
        const topics = mod.topics.filter((topic) => {
          if (filter === "due") {
            if (!topic.nextReviewAt) return false;
            if (new Date(topic.nextReviewAt).getTime() > now) return false;
          } else if (filter !== "all" && topic.status !== filter) {
            return false;
          }

          if (!query) return true;
          return (
            topic.title.toLowerCase().includes(query) ||
            topic.summary.toLowerCase().includes(query) ||
            topic.keyConcepts.some((c) => c.toLowerCase().includes(query)) ||
            topic.studyItems.some(
              (item) =>
                item.title.toLowerCase().includes(query) ||
                item.prompt.toLowerCase().includes(query)
            )
          );
        });
        return { ...mod, topics };
      })
      .filter((mod) => mod.topics.length > 0);
  }, [modules, filter, search]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-400" />
        Carregando os 5 módulos e 30 tópicos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-200 sm:p-6">
        {error}
      </div>
    );
  }

  const filterButtons: Array<{ value: FilterValue; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "due", label: "Para revisar" },
    { value: "not_started", label: "Não iniciados" },
    { value: "learning", label: "Aprendendo" },
    { value: "reviewing", label: "Revisando" },
    { value: "mastered", label: "Dominados" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Trilha Completa
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            5 módulos e 30 tópicos atômicos da transição Júnior → Pleno (JS/TS e
            Fundamentos).
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tópico ou conceito..."
            className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none sm:min-h-10 sm:py-2 sm:text-sm"
          />
        </div>
      </div>

      {/* Filtros: rolagem horizontal suave no mobile, wrap no desktop */}
      <div className="no-scrollbar -mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            type="button"
            onClick={() => setFilter(btn.value)}
            className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
              filter === btn.value
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Módulos */}
      {filteredModules.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
          Nenhum tópico encontrado com esse filtro.
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {filteredModules.map((mod) => {
            const originalMod =
              modules.find((m) => m.order === mod.order) ?? mod;
            const startedInMod = originalMod.topics.filter(
              (t) => t.status !== "not_started"
            ).length;
            const pct = Math.round(
              (startedInMod / Math.max(1, originalMod.topics.length)) * 100
            );

            return (
              <section
                key={mod.order}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
              >
                <div className="border-b border-slate-800/80 bg-slate-900/80 p-4 sm:p-5">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 sm:text-xs">
                        Módulo {mod.order}
                      </span>
                      <h2 className="mt-0.5 text-base font-semibold text-white sm:text-lg">
                        {mod.title}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {startedInMod}/{originalMod.topics.length} iniciados
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800 sm:w-24 sm:flex-none">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {mod.goal && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {mod.goal}
                    </p>
                  )}
                </div>

                <ul className="divide-y divide-slate-800/70">
                  {mod.topics.map((topic) => {
                    const review = formatNextReview(topic.nextReviewAt);
                    return (
                      <li key={topic.id}>
                        <Link
                          to={`/topico/${topic.id}`}
                          className="group flex flex-col gap-2.5 px-4 py-3.5 transition hover:bg-slate-800/40 active:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2 sm:items-center sm:justify-start">
                              <div className="flex min-w-0 items-baseline gap-2">
                                <span className="shrink-0 font-mono text-xs text-slate-500">
                                  #{String(topic.topicOrder).padStart(2, "0")}
                                </span>
                                <span className="line-clamp-2 text-sm font-semibold text-slate-100 group-hover:text-indigo-200 sm:truncate">
                                  {topic.title}
                                </span>
                              </div>
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 sm:hidden" />
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-400 sm:line-clamp-1">
                              {topic.summary}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:gap-2">
                            {topic.studyItems.length > 0 && (
                              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-400">
                                {topic.studyItems.length} itens
                              </span>
                            )}
                            {topic.practiceDone && (
                              <span
                                title="Prática manual concluída"
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Prática
                              </span>
                            )}
                            <ScoreBadge score={topic.lastScore} />
                            <StatusBadge status={topic.status} />
                            {topic.nextReviewAt && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
                                  review.isDue
                                    ? "border-amber-500/40 bg-amber-500/15 font-medium text-amber-300"
                                    : "border-slate-800 bg-slate-950/60 text-slate-400"
                                }`}
                              >
                                <Clock className="h-3 w-3" />
                                {review.text}
                              </span>
                            )}
                            <ChevronRight className="hidden h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-300 sm:block" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
