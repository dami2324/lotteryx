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

    const id = `${analysis.nextDraw.date}-${analysis.nextDraw.name}`;
    const saved = window.localStorage.getItem(HISTORY_KEY);
    const history = saved ? (JSON.parse(saved) as SavedRun[]) : [];
    const exists = history.some((item) => item.id === id && item.email === profile.email);
    if (exists) {
      return;
    }

    const nextHistory = [
      {
        id,
        date: analysis.nextDraw.date,
        draw: analysis.nextDraw.name,
        email: profile.email,
        topFive: analysis.topFive.map((pick) => pick.term),
        backups: analysis.backups.map((pick) => pick.term)
      },
      ...history
    ].slice(0, 20);

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  }, [analysis, profile]);

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

  if (!profile) {
    return (
      <main className="shell auth-shell">
        <section className="auth-card">
          <p className="brand">LotteryX</p>
          <h1>{greeting}</h1>
          <p className="draw-date">Guardamos tu historial en este dispositivo.</p>
          <form onSubmit={submitProfile}>
            <label>
              Nombre
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="given-name" />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
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
      <section className="summary">
        <div>
          <p className="brand">LotteryX</p>
          <h1>{greeting}</h1>
          <p className="draw-date">
            {analysis.nextDraw.name} · {analysis.nextDraw.label}
          </p>
        </div>
        <div className="current-date">
          <span>Hoy</span>
          <strong>{today}</strong>
        </div>
      </section>

      <section className="results">
        <div className="panel primary">
          <div className="panel-title">
            <h2>5 principales</h2>
            <span>Principal</span>
          </div>
          <PickList picks={analysis.topFive} start={1} />
        </div>

        <div className="panel backup">
          <div className="panel-title">
            <h2>5 backup</h2>
            <span>Backup</span>
          </div>
          <PickList picks={analysis.backups} start={6} />
        </div>
      </section>
    </main>
  );
}

function PickList({ picks, start }: { picks: Pick[]; start: number }) {
  return (
    <ol className="pick-list" start={start}>
      {picks.map((pick) => (
        <li key={pick.term}>
          <div className="rank-number">{pick.term}</div>
          <div className="pick-copy">
            <strong>{pick.score.toFixed(2)} pts</strong>
            <span>{pick.reason}</span>
            <small>
              2do/3ro: {pick.exposures} · 1ro: {pick.firstCount} · Brincos: {pick.verifiedJumps}
              {pick.averageJumpDelay !== null ? ` · Prom: ${pick.averageJumpDelay} sorteos` : ""}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}
