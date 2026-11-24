import { CalendarCheck2, LogOut, Map as MapIcon } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import { CortexLogo } from "./CortexLogo.tsx";

interface LayoutProps {
  onLogout: () => void;
}

export function Layout({ onLogout }: LayoutProps) {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      onLogout();
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      {/* Header Superior */}
      <header className="safe-pt sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3">
          <Link
            to="/"
            className="group flex min-h-11 items-center gap-2.5 text-slate-100 transition hover:text-indigo-300"
          >
            <CortexLogo className="h-9 w-9 shrink-0 shadow-sm shadow-indigo-950/50 transition-transform duration-200 group-hover:scale-105" />
            <div>
              <span className="block text-sm font-semibold tracking-tight">
                Cortex
              </span>
              <span className="block text-[11px] text-slate-400">
                Estudos Ativos · JS/TS
              </span>
            </div>
          </Link>

          {/* Navegação Desktop */}
          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-2 sm:flex"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/40"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`
              }
            >
              <CalendarCheck2 className="h-4 w-4" />
              <span>Hoje</span>
            </NavLink>

            <NavLink
              to="/trilha"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/40"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`
              }
            >
              <MapIcon className="h-4 w-4" />
              <span>Trilha</span>
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              title="Sair"
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </nav>

          {/* Botão Sair no Mobile (alvo >= 44px) */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair"
            title="Sair"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-900 hover:text-rose-300 active:scale-95 sm:hidden"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal (com espaço extra embaixo no mobile para a bottom bar) */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-24 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar (somente Mobile) */}
      <nav
        aria-label="Navegação mobile"
        className="safe-pb fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/90 bg-slate-950/95 backdrop-blur-md sm:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-2 px-2 py-1.5">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                isActive
                  ? "bg-indigo-600/15 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            <CalendarCheck2 className="h-5 w-5" />
            <span>Hoje</span>
          </NavLink>

          <NavLink
            to="/trilha"
            className={({ isActive }) =>
              `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                isActive
                  ? "bg-indigo-600/15 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            <MapIcon className="h-5 w-5" />
            <span>Trilha</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
