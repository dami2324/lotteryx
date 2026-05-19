"use client";

import { useEffect, useMemo, useState } from "react";
import type { PatternAnalysis, Pick, DrawRow } from "@/lib/lottery";

type Profile = {
  name: string;
  email: string;
};

type SavedRun = {
  id: string;
  email: string;
  date: string;
  draw: string;
  picks: string[];
};

const PROFILE_KEY = "lotteryx_profile";
const HISTORY_KEY = "lotteryx_pick_history";

export function LotteryXClient({ analysis }: { analysis: PatternAnalysis }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [today, setToday] = useState("");
  
  const [currentAnalysis, setCurrentAnalysis] = useState<PatternAnalysis>(analysis);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<"picks" | "search">("picks");
  const [history, setHistory] = useState<DrawRow[]>([]);
  const [searchDate, setSearchDate] = useState("");
  const [searchResult, setSearchResult] = useState<DrawRow | null | "not_found">(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(PROFILE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Profile;
      setProfile(parsed);
    }

    setToday(
      new Intl.DateTimeFormat("es-PA", {
        timeZone: "America/Panama",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date())
    );
  }, []);

  const allPicks = useMemo(() => {
    return [...currentAnalysis.topFive, ...currentAnalysis.backups];
  }, [currentAnalysis]);

  useEffect(() => {
    if (!profile) return;

    const id = `${currentAnalysis.nextDraw.date}-${currentAnalysis.nextDraw.name}`;
    const saved = window.localStorage.getItem(HISTORY_KEY);
    const hist = saved ? (JSON.parse(saved) as SavedRun[]) : [];
    const exists = hist.some((item) => item.id === id && item.email === profile.email);
    if (exists) return;

    const nextHistory = [
      {
        id,
        date: currentAnalysis.nextDraw.date,
        draw: currentAnalysis.nextDraw.name,
        email: profile.email,
        picks: allPicks.map((pick) => pick.term),
      },
      ...hist
    ].slice(0, 20);

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  }, [currentAnalysis, profile, allPicks]);

  const greeting = useMemo(() => {
    if (!profile) return "Ingresa para ver tus numeros";
    return `${profile.name}, tus 10 números pro`;
  }, [profile]);

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = {
      name: name.trim(),
      email: email.trim().toLowerCase()
    };
    if (!nextProfile.name || !nextProfile.email) return;

    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextProfile)
    }).catch(() => undefined);
    setProfile(nextProfile);
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/picks");
      if (res.ok) {
        const data = await res.json();
        setCurrentAnalysis(data);
      }
    } catch (error) {
      console.error("Error updating picks", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
  };

  const handleShare = () => {
    const text = `LotteryX - Mis 10 números para el ${currentAnalysis.nextDraw.label}:\n\n${allPicks.map(p => p.term).join(' - ')}\n\nPatrón verificado estadísticamente.`;
    if (navigator.share) {
      navigator.share({ title: "LotteryX", text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const handleDownload = () => {
    const text = `LotteryX - Sorteo ${currentAnalysis.nextDraw.label}\n\nLos 10 principales:\n${allPicks.map(p => p.term).join(', ')}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lotteryx-${currentAnalysis.nextDraw.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setSearchResult(null);
    let data = history;
    if (!data.length) {
      try {
        const res = await fetch("/api/history");
        data = await res.json();
        setHistory(data);
      } catch (e) {}
    }
    const found = data.find(d => d.date === searchDate);
    setSearchResult(found || "not_found");
    setIsSearching(false);
  };

  if (!profile) {
    return (
      <main className="shell auth-shell">
        <section className="auth-card glass-panel">
          <p className="brand">LotteryX</p>
          <h1>{greeting}</h1>
          <p className="draw-date">Tus números calculados con inteligencia estadística.</p>
          <form onSubmit={submitProfile}>
            <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required /></label>
            <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <button type="submit">Entrar</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="summary glass-panel">
        <div>
          <p className="brand">LotteryX Pro</p>
          <h1>{greeting}</h1>
          <p className="draw-date">
            Sorteo {currentAnalysis.nextDraw.name} · {currentAnalysis.nextDraw.label}
          </p>
        </div>
        <div className="actions-container">
          <div className="current-date">
            <span>Hoy</span>
            <strong>{today}</strong>
          </div>
          <div className="header-buttons">
            <button onClick={handleRefresh} disabled={isRefreshing} className="btn-refresh" title="Actualizar datos">
              <svg className={isRefreshing ? "spin" : ""} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
              {isRefreshing ? "Calculando..." : "Actualizar"}
            </button>
            <button onClick={handleLogout} className="btn-logout" title="Salir">Salir</button>
          </div>
        </div>
      </header>

      <div className="tabs">
        <button className={activeTab === "picks" ? "active" : ""} onClick={() => setActiveTab("picks")}>Tus 10 Números</button>
        <button className={activeTab === "search" ? "active" : ""} onClick={() => setActiveTab("search")}>Buscar Sorteo Pasado</button>
      </div>

      {activeTab === "picks" && (
        <section className="results">
          <div className="panel primary glass-panel full-width">
            <div className="panel-title flex-between">
              <h2>Los 10 Principales</h2>
              <div className="share-buttons">
                <button onClick={handleShare} className="btn-icon" title="Compartir">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Compartir
                </button>
                <button onClick={handleDownload} className="btn-icon" title="Descargar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Descargar
                </button>
              </div>
            </div>
            <PickList picks={allPicks} />
          </div>
        </section>
      )}

      {activeTab === "search" && (
        <section className="search-section glass-panel">
          <h2>Ver resultados históricos</h2>
          <form onSubmit={handleSearch} className="search-form">
            <input 
              type="date" 
              value={searchDate} 
              onChange={(e) => setSearchDate(e.target.value)} 
              required 
            />
            <button type="submit" disabled={isSearching}>
              {isSearching ? "Buscando..." : "Buscar"}
            </button>
          </form>

          {searchResult === "not_found" && (
            <div className="search-empty">No se encontró ningún sorteo para esa fecha en nuestros registros. Asegúrate de elegir miércoles o domingo.</div>
          )}

          {searchResult && searchResult !== "not_found" && (
            <div className="search-result">
              <h3>{searchResult.draw} · {searchResult.date}</h3>
              <div className="prizes">
                <div className="prize-card">
                  <span>1ro</span>
                  <strong>{searchResult.first}</strong>
                </div>
                <div className="prize-card">
                  <span>2do</span>
                  <strong>{searchResult.second}</strong>
                </div>
                <div className="prize-card">
                  <span>3ro</span>
                  <strong>{searchResult.third}</strong>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function PickList({ picks }: { picks: Pick[] }) {
  return (
    <div className="pick-grid">
      {picks.map((pick) => (
        <div key={pick.term} className="pick-card">
          <div className="rank-number">{pick.term}</div>
          <div className="pick-copy">
            <strong>{pick.score.toFixed(2)} pts</strong>
            <span>{pick.reason}</span>
            <small>2do/3ro: {pick.exposures} · 1ro: {pick.firstCount} · Brincos: {pick.verifiedJumps}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
