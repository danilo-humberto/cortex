import { KeyRound, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CortexLogo } from "../components/CortexLogo.tsx";
import { ApiError, api } from "../lib/api.ts";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessKey.trim()) {
      setError("Digite sua chave pessoal de acesso.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.login(accessKey.trim());
      onSuccess();
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível validar seu acesso agora.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="safe-pt safe-pb flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <CortexLogo className="mb-3.5 h-14 w-14 shadow-lg shadow-indigo-950/60" />
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Cortex
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Sistema pessoal de estudos ativos · Júnior → Pleno
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="access-key"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Chave de acesso pessoal
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="access-key"
                type="password"
                autoFocus
                autoComplete="current-password"
                enterKeyHint="go"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Digite sua APP_ACCESS_KEY"
                className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:min-h-11 sm:py-2.5 sm:text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:py-2.5 sm:text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Entrar na Sala de Estudos"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Sessão protegida por cookie HttpOnly assinado (30 dias).
        </p>
      </div>
    </div>
  );
}
