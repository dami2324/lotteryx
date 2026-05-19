"use client";

import { useEffect, useMemo, useState } from "react";
import type { PatternAnalysis, Pick } from "@/lib/lottery";

type Profile = {
  name: string;
  email: string;
};

type SavedRun = {
  id: string;
  email: string;
  date: string;
  draw: string;
  topFive: string[];
  backups: string[];
};

const PROFILE_KEY = "lotteryx_profile";
const HISTORY_KEY = "lotteryx_pick_history";

export function LotteryXClient({ analysis }: { analysis: PatternAnalysis }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [today, setToday] = useState("");
  
  // New state for refresh functionality
  const [currentAnalysis, setCurrentAnalysis] = useState<PatternAnalysis>(analysis);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  useEffect(() => {
    if (!profile) {
      return;
    }

    const id = `${currentAnalysis.nextDraw.date}-${currentAnalysis.nextDraw.name}`;
    const saved = window.localStorage.getItem(HISTORY_KEY);
    const history = saved ? (JSON.parse(saved) as SavedRun[]) : [];
    const exists = history.some((item) => item.id === id && item.email === profile.email);
    if (exists) {
      return;
    }

    const nextHistory = [
      {
        id,
        date: currentAnalysis.nextDraw.date,
        draw: currentAnalysis.nextDraw.name,
        email: profile.email,
        topFive: currentAnalysis.topFive.map((pick) => pick.term),
        backups: currentAnalysis.backups.map((pick) => pick.term)
      },
      ...history
    ].slice(0, 20);

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  }, [currentAnalysis, profile]);

  const greeting = useMemo(() => {
    if (!profile) {
      return "Ingresa para ver tus numeros";
    }

    return `${profile.name}, para ti tengo estos numeros`;
  }, [profile]);

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = {
      name: name.trim(),
      email: email.trim().toLowerCase()
    };

    if (!nextProfile.name || !nextProfile.email) {
      return;
    }

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

  if (!profile) {
    return (
      <main className="shell auth-shell">
        <section className="auth-card glass-panel">
          <p className="brand">LotteryX</p>
          <h1>{greeting}</h1>
          <p className="draw-date">Tus números calculados con inteligencia estadística.</p>
          <form onSubmit={submitProfile}>
            <label>
              Nombre
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="given-name" required />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <button type="submit">Entrar</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="summary glass-panel">
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
          <button onClick={handleRefresh} disabled={isRefreshing} className="btn-refresh" title="Actualizar datos">
            <svg
              className={isRefreshing ? "spin" : ""}
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21v-5h5" />
            </svg>
            {isRefreshing ? "Calculando..." : "Actualizar"}
          </button>
        </div>
      </section>

      <section className="results">
        <div className="panel primary glass-panel">
          <div className="panel-title">
            <h2>5 Principales</h2>
          </div>
          <PickList picks={currentAnalysis.topFive} />
        </div>

        <div className="panel backup glass-panel">
          <div className="panel-title">
            <h2>5 de Backup</h2>
          </div>
          <PickList picks={currentAnalysis.backups} />
        </div>
      </section>
    </main>
  );
}

function PickList({ picks }: { picks: Pick[] }) {
  return (
    <ul className="pick-list">
      {picks.map((pick) => (
        <li key={pick.term}>
          <div className="rank-number">{pick.term}</div>
          <div className="pick-copy">
            <strong>{pick.score.toFixed(2)} pts</strong>
            <span>{pick.reason}</span>
            <small>
              2do/3ro: {pick.exposures} · 1ro: {pick.firstCount} · Brincos: {pick.verifiedJumps}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}
