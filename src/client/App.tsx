import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CortexLogo } from "./components/CortexLogo.tsx";
import { Layout } from "./components/Layout.tsx";
import { api } from "./lib/api.ts";
import { LoginPage } from "./pages/LoginPage.tsx";
import { RoadmapPage } from "./pages/RoadmapPage.tsx";
import { TodayPage } from "./pages/TodayPage.tsx";
import { TopicStudyPage } from "./pages/TopicStudyPage.tsx";

export function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api
      .authMe()
      .then((res) => {
        if (active) setAuthenticated(res.authenticated);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3.5 bg-slate-950 text-slate-400">
        <CortexLogo className="h-12 w-12 shadow-lg shadow-indigo-950/60" />
        <div className="flex items-center text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-400" />
          Verificando sessão...
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onSuccess={() => setAuthenticated(true)} />
            )
          }
        />

        <Route
          element={
            authenticated ? (
              <Layout onLogout={() => setAuthenticated(false)} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/" element={<TodayPage />} />
          <Route path="/trilha" element={<RoadmapPage />} />
          <Route path="/topico/:id" element={<TopicStudyPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
