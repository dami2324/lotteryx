"use client";

import { useEffect, useMemo, useState } from "react";
import type { PatternAnalysis, Pick, DrawRow } from "@/lib/lottery";
import type { Ticket, UserStats, DrawType, GenerationRecord } from "@/lib/types";

type Profile = {
  name: string;
  email: string;
  token: string;
  plan?: "free" | "pro";
  subscriptionStatus?: "free" | "active" | "canceled" | "expired";
  proUntil?: string;
  favoriteStrategy?: string;
  drawPreference?: string;
  notificationEmail?: boolean;
  notificationPush?: boolean;
  favorites?: string[];
  tickets?: Ticket[];
  stats?: UserStats;
  generationHistory?: GenerationRecord[];
  alertsConfig?: Record<string, boolean>;
  photo?: string;
};

const PROFILE_KEY = "lotteryx_profile";

const DRAWS = [
  { id: "Miercolito" as DrawType, label: "Miercolito", icon: "🎯", desc: "Miércoles" },
  { id: "Dominical" as DrawType, label: "Dominical", icon: "🌟", desc: "Domingo" },
  { id: "Gordito" as DrawType, label: "Gordito", icon: "🐷", desc: "Viernes" },
  { id: "Extraordinaria" as DrawType, label: "Extraordinaria", icon: "💎", desc: "Especial" },
];

const STRATEGIES = [
  { id: "hot", label: "Calientes", icon: "🔥", desc: "Mayor frecuencia reciente" },
  { id: "cold", label: "Fríos", icon: "❄️", desc: "Mayor ausencia reciente" },
  { id: "most_played", label: "Más Jugados", icon: "🏆", desc: "Más veces en 1er premio" },
  { id: "jump", label: "Patrón Brinco", icon: "🦘", desc: "Salto de 2do/3ro a 1ro" },
  { id: "last_year", label: "Jugó el año pasado", icon: "📅", desc: "Puede salir de nuevo en este sorteo" },
];

const FREE_DRAWS = new Set<DrawType>(["Miercolito", "Dominical"]);
const FREE_STRATEGIES = new Set(["hot", "cold"]);

const TIME_RANGES = [
  { id: "30", label: "30 Días", icon: "📅" },
  { id: "60", label: "60 Días", icon: "📆" },
  { id: "90", label: "90 Días", icon: "🗓️" },
  { id: "180", label: "180 Días", icon: "📊" },
];

export function LotteryXClient({ analysis }: { analysis: PatternAnalysis }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentAnalysis, setCurrentAnalysis] = useState<PatternAnalysis>(analysis);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<"wizard" | "stats" | "favorites" | "tickets" | "profile" | "history" | "dreams" | "pyramids" | "alerts">("wizard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Wizard step state
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardDraw, setWizardDraw] = useState<DrawType | null>(null);
  const [wizardStrategy, setWizardStrategy] = useState<string | null>(null);
  const [wizardTimeRange, setWizardTimeRange] = useState<string>("180");
  const [hasGenerated, setHasGenerated] = useState(false);

  // Ticket form state
  const [ticketDate, setTicketDate] = useState("");
  const [ticketDraw, setTicketDraw] = useState<DrawType>("Miercolito");
  const [ticketNumber, setTicketNumber] = useState("");
  const [isAddingTicket, setIsAddingTicket] = useState(false);

  // Stats tab state
  const [statsDraw, setStatsDraw] = useState<DrawType>("Miercolito");
  const [statsTimeRange, setStatsTimeRange] = useState<string>("180");
  const [independentStats, setIndependentStats] = useState<any[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [officialHistory, setOfficialHistory] = useState<DrawRow[]>([]);

  // Dreams tab state
  const [dreamQuery, setDreamQuery] = useState("");
  const [dreamResults, setDreamResults] = useState<{word: string, number: string}[]>([]);
  const [isDreamLoading, setIsDreamLoading] = useState(false);
  const [dreamSearched, setDreamSearched] = useState(false);

  // Alerts tab state
  const [alertsState, setAlertsState] = useState<Record<string, boolean>>({
    gordito: true,
    morning: true,
    dominical: false,
    miercolito: false,
    reminder: true
  });
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);

  useEffect(() => {
    if (profile?.alertsConfig) {
      setAlertsState(prev => ({ ...prev, ...profile.alertsConfig }));
    }
  }, [profile]);

  const handleSaveAlerts = async () => {
    if (!profile) return;
    setIsSavingAlerts(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${profile.token}`
        },
        body: JSON.stringify({ alertsConfig: alertsState })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        const updatedProfile = { ...profile, alertsConfig: data.user.alertsConfig };
        setProfile(updatedProfile);
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
        alert("¡Alertas guardadas exitosamente!");
      } else {
        alert("Error al guardar preferencias.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión al guardar preferencias.");
    } finally {
      setIsSavingAlerts(false);
    }
  };

  useEffect(() => {
    if (activeTab === "dreams" && dreamResults.length === 0 && !dreamSearched) {
      fetch("/api/dreams").then(r => r.json()).then(d => setDreamResults(d.results || []));
    }
  }, [activeTab, dreamSearched, dreamResults.length]);

  const handleDreamSearch = async () => {
    if (!dreamQuery.trim()) return;
    setIsDreamLoading(true);
    setDreamSearched(true);
    try {
      const res = await fetch(`/api/dreams?q=${encodeURIComponent(dreamQuery)}`);
      const data = await res.json();
      setDreamResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDreamLoading(false);
    }
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(PROFILE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Profile;
      setProfile(parsed);
      syncProfile(parsed.token);
    }
  }, []);

  const syncProfile = async (token: string) => {
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const updatedProfile = { ...data.user, token };
        setProfile(updatedProfile);
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (e) {
      console.error("Failed to sync profile");
    }
  };

  useEffect(() => {
    if (activeTab === "stats") {
      setIsStatsLoading(true);
      fetch(`/api/stats?draw=${statsDraw}&timeRange=${statsTimeRange}`)
        .then(res => res.json())
        .then(data => {
          setIndependentStats(data.stats || []);
        })
        .catch(console.error)
        .finally(() => setIsStatsLoading(false));
    }
  }, [activeTab, statsDraw, statsTimeRange]);

  useEffect(() => {
    if ((activeTab === "favorites" || activeTab === "wizard") && officialHistory.length === 0) {
      fetch("/api/history")
        .then(res => res.json())
        .then(data => Array.isArray(data) && setOfficialHistory(data))
        .catch(console.error);
    }
  }, [activeTab, officialHistory.length]);

  const nextDrawInfo = useMemo(() => {
    const now = new Date();
    const panamaOffset = -5 * 60;
    const panamaTime = new Date(now.getTime() + (panamaOffset - now.getTimezoneOffset()) * 60000);
    
    const day = panamaTime.getDay();
    const hour = panamaTime.getHours();
    
    let nextDate = new Date(panamaTime);
    let drawName = "Miercolito";
    let drawHour = 15;

    if (day === 0) {
      if (hour >= 15) {
        nextDate.setDate(nextDate.getDate() + 3);
      } else {
        drawName = "Dominical";
      }
    } else if (day === 3) {
      if (hour >= 15) {
        nextDate.setDate(nextDate.getDate() + 4);
        drawName = "Dominical";
      }
    } else if (day > 0 && day < 3) {
      nextDate.setDate(nextDate.getDate() + (3 - day));
    } else if (day > 3) {
      nextDate.setDate(nextDate.getDate() + (7 - day));
      drawName = "Dominical";
    }

    const isToday = nextDate.getDate() === panamaTime.getDate() && nextDate.getMonth() === panamaTime.getMonth();
    
    let dateStr = nextDate.toLocaleDateString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    
    return {
      name: drawName,
      date: dateStr,
      isToday,
      timeStr: "3:00 PM"
    };
  }, []);

  const allPicks = useMemo(() => {
    return [...currentAnalysis.topFive, ...currentAnalysis.backups];
  }, [currentAnalysis]);

  const isPro = useMemo(() => {
    if (!profile) return false;
    if (profile.plan === "pro") return true;
    if ((profile.subscriptionStatus === "active" || profile.subscriptionStatus === "canceled") && profile.proUntil) {
      return new Date(profile.proUntil).getTime() > Date.now();
    }
    return false;
  }, [profile]);

  const displayPicks = useMemo(() => {
    if (isPro) {
      return allPicks.map((pick) => ({ pick, locked: false }));
    }

    const lowScore = [...allPicks].sort((a, b) => a.score - b.score || a.term.localeCompare(b.term)).slice(0, 3);
    const visible = new Set(lowScore.map((pick) => pick.term));
    const lockedHighScore = [...allPicks]
      .filter((pick) => !visible.has(pick.term))
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
      .slice(0, 7);

    return [
      ...lowScore.map((pick) => ({ pick, locked: false })),
      ...lockedHighScore.map((pick) => ({ pick, locked: true }))
    ];
  }, [allPicks, isPro]);

  const shareablePicks = useMemo(() => {
    return isPro ? allPicks : displayPicks.filter((item) => !item.locked).map((item) => item.pick);
  }, [allPicks, displayPicks, isPro]);

  const availableDraws = useMemo(() => {
    return isPro ? DRAWS : DRAWS.filter((draw) => FREE_DRAWS.has(draw.id));
  }, [isPro]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setIsSubmitting(true);

    const emailTrimmed = email.trim().toLowerCase();
    const passTrimmed = password.trim();

    if (!emailTrimmed || !passTrimmed || (authMode === "register" && !name.trim())) {
      setAuthError("Completa todos los campos");
      setIsSubmitting(false);
      return;
    }

    if (authMode === "register") {
      if (passTrimmed.length < 6) {
        setAuthError("La contraseña debe tener al menos 6 caracteres.");
        setIsSubmitting(false);
        return;
      }
      if (passTrimmed !== confirmPassword.trim()) {
        setAuthError("Las contraseñas no coinciden.");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const endpoint = authMode === "login" ? "/api/login" : "/api/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: emailTrimmed, password: passTrimmed })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");

      const newProfile: Profile = {
        name: data.name,
        email: data.email,
        token: data.token,
        drawPreference: data.drawPreference,
        favorites: data.favorites || [],
        tickets: data.tickets || [],
        stats: data.stats || { totalTickets: 0, totalWins: 0, totalMatchedDigits: 0 },
        generationHistory: data.generationHistory || [],
        plan: data.plan || "free",
        subscriptionStatus: data.subscriptionStatus || "free",
        proUntil: data.proUntil,
        favoriteStrategy: data.favoriteStrategy || "hot",
        notificationEmail: data.notificationEmail,
        notificationPush: data.notificationPush
      };
      setProfile(newProfile);
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
    } catch (e: any) {
      setAuthError(e.message || "Credenciales incorrectas");
    } finally {
      setIsSubmitting(false);
    }
  }


  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const body: any = {};
    if (editName.trim() && editName !== profile.name) body.name = editName.trim();
    if (editPhoto.trim() !== (profile.photo || "")) body.photo = editPhoto.trim();
    if (editPassword.trim()) body.password = editPassword.trim();
    
    if (Object.keys(body).length === 0) {
      setEditingProfile(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.user) {
        const updated = { ...profile, ...data.user, token: profile.token };
        setProfile(updated);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
        setEditingProfile(false);
        setEditPassword("");
      } else {
        alert(data.error || "Error al actualizar perfil");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexion");
    }
  };

  const handleClearHistory = async () => {
    if (!profile) return;
    if (!confirm("¿Seguro que quieres borrar todo tu historial de generaciones?")) return;
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.token}` },
        body: JSON.stringify({ generationHistory: [] })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        const updated = { ...profile, ...data.user, token: profile.token };
        setProfile(updated);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error(e);
    }
  };

  function handleLogout() {
    window.localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setActiveTab("wizard");
    resetWizard();
    setAuthMode("login");
  }

  async function handleDeleteAccount() {
    if (!profile) return;
    const confirmDelete = window.confirm(
      "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer y perderás tu historial, favoritos y billetes guardados."
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${profile.token}` }
      });
      if (res.ok) {
        alert("Cuenta eliminada exitosamente.");
        handleLogout();
      } else {
        alert("Hubo un error al eliminar tu cuenta.");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión al eliminar la cuenta.");
    }
  }

  function resetWizard() {
    setWizardStep(1);
    setWizardDraw(null);
    setWizardStrategy(null);
    setWizardTimeRange("180");
    setHasGenerated(false);
  }

  async function toggleFavorite(term: string) {
    if (!profile) return;
    const isFav = profile.favorites?.includes(term);
    let newFavs = profile.favorites || [];

    if (isFav) {
      newFavs = newFavs.filter(f => f !== term);
    } else {
      newFavs = [...newFavs, term];
    }

    const updatedProfile = { ...profile, favorites: newFavs };
    setProfile(updatedProfile);
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));

    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${profile.token}`
        },
        body: JSON.stringify({ favorites: newFavs })
      });
    } catch (e) {
      console.error("Failed to save favorite");
    }
  }

  function handleUpgrade() {
    if (!profile) return;
    const url = `https://payhip.com/buy?link=ih1Cy&email=${encodeURIComponent(profile.email)}`;
    window.location.href = url;
  }

  const addTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !ticketDate || !ticketNumber || !ticketDraw) return;

    setIsAddingTicket(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${profile.token}`
        },
        body: JSON.stringify({
          date: ticketDate,
          draw: ticketDraw,
          number: ticketNumber
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedTickets = [...(profile.tickets || []), data.ticket];
        setProfile({ ...profile, tickets: updatedTickets, stats: data.stats });
        setTicketNumber("");
      }
    } catch (e) {
      console.error("Error adding ticket", e);
    } finally {
      setIsAddingTicket(false);
    }
  };

  const clearTicketHistory = async () => {
    if (!profile) return;
    if (!window.confirm("¿Seguro que quieres borrar todo el historial de compras?")) return;
    
    try {
      const updatedProfile = { ...profile, tickets: [] };
      setProfile(updatedProfile);
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
      
      await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${profile.token}`
        },
        body: JSON.stringify({ tickets: [] })
      });
    } catch (e) {
      console.error("Error clearing tickets", e);
    }
  };

  const handleGenerate = async (strategyOverride?: string) => {
    const selectedStrategy = strategyOverride || wizardStrategy;
    const selectedTimeRange = "180";
    if (!selectedStrategy || !wizardDraw) return;
    if (!isPro && (!FREE_DRAWS.has(wizardDraw) || !FREE_STRATEGIES.has(selectedStrategy))) {
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/picks?strategy=${selectedStrategy}&timeRange=${selectedTimeRange}&draw=${wizardDraw}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentAnalysis(data);
        setHasGenerated(true);

        if (profile) {
          const generatedPicks = [...data.topFive, ...data.backups].map((p: Pick) => p.term);
          const newGen = {
            draw: wizardDraw,
            strategy: selectedStrategy,
            timeRange: selectedTimeRange,
            picks: generatedPicks,
            tickets: data.generatedTickets || []
          };
          const optimisticHistory = [
            ...(profile.generationHistory || []),
            {
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              ...newGen
            }
          ].slice(-20);
          const optimisticProfile = { ...profile, generationHistory: optimisticHistory, favoriteStrategy: selectedStrategy };
          setProfile(optimisticProfile);
          window.localStorage.setItem(PROFILE_KEY, JSON.stringify(optimisticProfile));

          const profileRes = await fetch("/api/profile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${profile.token}`
            },
            body: JSON.stringify({ newGeneration: newGen, favoriteStrategy: selectedStrategy })
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            const updatedProfile = { 
              ...profile, 
              generationHistory: profileData.user?.generationHistory || profile.generationHistory || [] 
            };
            setProfile(updatedProfile);
            window.localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
          }
        }
      }
    } catch (e) {
      console.error("Failed to generate", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const shareResults = async () => {
    const text = `Mis números recomendados para la lotería (${wizardDraw}):\n` +
      shareablePicks.map(p => `• ${p.term} (Score: ${p.score})`).join("\n") +
      (isPro ? `\n\nBilletes sugeridos:\n${(currentAnalysis.generatedTickets || []).map(t => `• ${t}`).join("\n")}` : "") +
      `\n\n¡Generado con LotteryX!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mis Números de LotteryX",
          text: text,
        });
      } catch (e) {
        console.error("Error sharing", e);
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  const downloadResults = () => {
    const text = `Mis números recomendados para la lotería (${wizardDraw}):\n\n` +
      shareablePicks.map(p => `• ${p.term} (Score: ${p.score}) - ${p.reason}`).join("\n\n") +
      (isPro ? `\n\nBilletes sugeridos:\n${(currentAnalysis.generatedTickets || []).map(t => `• ${t}`).join("\n")}` : "") +
      `\n\nGenerado el: ${new Date().toLocaleString()}\n¡Con LotteryX!`;
    
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lotteryx_numeros_${wizardDraw}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---------- AUTH SCREEN ----------
  if (!profile) {
    return (
      <main className="shell auth-shell">
        <section className="auth-card glass-panel">
          <p className="brand">LotteryX</p>
          <h1>{authMode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}</h1>
          <p className="draw-date">Tus números calculados con inteligencia estadística.</p>
          <form onSubmit={submitAuth}>
            {authError && <div className="auth-error">{authError}</div>}

            {authMode === "register" && (
              <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
            )}

            <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>Contraseña
              <div className="password-wrapper">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"} required />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>

            {authMode === "register" && (
              <label>Confirmar Contraseña
                <div className="password-wrapper">
                  <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
                </div>
              </label>
            )}

            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Procesando..." : authMode === "login" ? "Entrar" : "Registrarme"}</button>
          </form>

          <div className="auth-switch">
            {authMode === "login" ? (
              <p>¿No tienes cuenta? <button type="button" onClick={() => { setAuthMode("register"); setAuthError(""); }}>Regístrate aquí</button></p>
            ) : (
              <p>¿Ya tienes cuenta? <button type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }}>Inicia sesión</button></p>
            )}
          </div>
        </section>
      </main>
    );
  }

  const userFavs = profile.favorites || [];
  const favoriteRows = userFavs.map((term) => {
    const pick = allPicks.find(p => p.term === term);
    const hits = officialHistory.filter(row => row.firstTerm === term || row.secondTerm === term || row.thirdTerm === term);
    return { term, pick, hits };
  });
  const userTickets = profile.tickets || [];
  const stats = profile.stats || { totalTickets: 0, totalWins: 0, totalMatchedDigits: 0 };

  const hotStats = independentStats.filter(s => s.label === "HOT").slice(0, 5);
  const coldStats = independentStats.filter(s => s.label === "COLD").slice(0, 5);
  const statsDisplay = [...hotStats, ...coldStats];
  const maxFreq = Math.max(1, ...statsDisplay.map(s => s.frequency));

  // ---------- MAIN APP ----------
  return (
    <div className="app-layout">
      {/* ===== SIDEBAR ===== */}
      <aside className={`app-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <p className="brand">LotteryX</p>
          <h2 className="greeting">Hola, {profile.name.split(" ")[0]} 👋</h2>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">SORTEOS</div>
          <button className={`nav-item ${activeTab === "wizard" ? "active" : ""}`} onClick={() => { setActiveTab("wizard"); setMobileMenuOpen(false); }}>
            <span>🏠</span> Inicio
          </button>
          <div className="sidebar-section">HERRAMIENTAS</div>
          <button className={`nav-item ${activeTab === "stats" ? "active" : ""}`} onClick={() => {
            if (!isPro) { setShowPricingModal(true); return; }
            setActiveTab("stats"); setMobileMenuOpen(false);
          }}>
            <span>📊</span> Estadísticas
          </button>
          <button className={`nav-item ${activeTab === "tickets" ? "active" : ""}`} onClick={() => { setActiveTab("tickets"); setMobileMenuOpen(false); }}>
            <span>🎟️</span> Verificar billete
          </button>
          <button className={`nav-item ${activeTab === "dreams" ? "active" : ""}`} onClick={() => {
            if (!isPro) { setShowPricingModal(true); return; }
            setActiveTab("dreams"); setMobileMenuOpen(false);
          }}>
            <span>🌙</span> Diccionario sueños
          </button>
          <div className="sidebar-section">CUENTA</div>
          <button className={`nav-item ${activeTab === "favorites" ? "active" : ""}`} onClick={() => {
            if (!isPro) { setShowPricingModal(true); return; }
            setActiveTab("favorites"); setMobileMenuOpen(false);
          }}>
            <span>⭐</span> Favoritos
          </button>
          <button className={`nav-item ${activeTab === "alerts" ? "active" : ""}`} onClick={() => { setActiveTab("alerts"); setMobileMenuOpen(false); }}>
            <span>🔔</span> Alertas
          </button>
          <button className={`nav-item ${activeTab === "profile" ? "active" : ""}`} onClick={() => { setActiveTab("profile"); setMobileMenuOpen(false); }}>
            <span>⚙️</span> Configuración
          </button>
        </nav>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="app-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div className="mobile-only-header" style={{ display: "none" }}>
            <p className="brand" style={{ fontSize: "1.1rem", margin: 0, padding: 0 }}>LotteryX</p>
            <h2 className="greeting" style={{ fontSize: "1.2rem", margin: "4px 0 0 0", padding: 0 }}>Hola, {profile.name.split(" ")[0]} 👋</h2>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? "✖ Cerrar" : "☰ Menú"}
          </button>
          <div style={{ marginLeft: "auto" }}>
            {isPro ? (
              <div className="plan-pill pro" style={{ width: "fit-content", padding: "6px 12px" }}>Pro activo</div>
            ) : (
              <a href={`https://payhip.com/buy?link=ih1Cy&email=${encodeURIComponent(profile.email)}`} className="payhip-buy-button premium-upgrade-btn" data-theme="green" data-product="ih1Cy" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>
                🚀 Desbloquear Pro
              </a>
            )}
          </div>
        </div>
        <div className="tab-content">
        {/* ========== WIZARD TAB ========== */}
        {activeTab === "wizard" && (
          <div className="fade-in">
            {/* NEXT DRAW BANNER */}
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px 24px", borderRadius: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: "#f8fafc" }}>{nextDrawInfo.name}</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>{nextDrawInfo.date}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(239, 68, 68, 0.1)", padding: "6px 12px", borderRadius: "20px", color: "#ef4444", fontSize: "0.85rem", fontWeight: 600, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", backgroundColor: "#ef4444", borderRadius: "50%", animation: "pulse 2s infinite" }}></span>
                {nextDrawInfo.isToday ? "Sorteo hoy" : "Próximo sorteo"} {nextDrawInfo.timeStr}
              </div>
            </div>

            <div className="wizard-layout">
              <div>
                {!hasGenerated ? (
                  <section className="wizard-container" style={{ margin: 0, width: "100%", maxWidth: "none" }}>
                    {/* STEP INDICATORS */}
                <div className="step-indicators">
                  {[1, 2].map(s => (
                    <div key={s} className={`step-dot ${wizardStep >= s ? "active" : ""} ${wizardStep === s ? "current" : ""}`}>
                      <span>{s}</span>
                    </div>
                  ))}
                  <div className="step-line" />
                </div>

                {/* STEP 1: DRAW */}
                {wizardStep === 1 && (
                  <div className="wizard-step fade-in">
                    <h2 className="wizard-title">Escoge tu Sorteo</h2>
                    <p className="wizard-subtitle">¿En cuál sorteo vas a jugar?</p>
                    <div className="icon-grid">
                      {DRAWS.map(d => {
                        const locked = !isPro && !FREE_DRAWS.has(d.id);
                        return (
                        <button
                          key={d.id}
                          className={`icon-card ${wizardDraw === d.id ? "selected" : ""} ${locked ? "locked-option" : ""}`}
                          onClick={() => {
                            if (locked) {
                              setShowPricingModal(true);
                              return;
                            }
                            setWizardDraw(d.id); setWizardStep(2); 
                          }}
                        >
                          <span className="icon-card-emoji">{d.icon}</span>
                          <span className="icon-card-label">{d.label}</span>
                          <span className="icon-card-desc">{d.desc}</span>
                          {locked && <span className="lock-chip">🔒 Pro</span>}
                        </button>
                      )})}
                    </div>
                  </div>
                )}

                {/* STEP 2: STRATEGY */}
                {wizardStep === 2 && (
                  <div className="wizard-step fade-in">
                    <h2 className="wizard-title">Elige tu Estrategia</h2>
                    <p className="wizard-subtitle">¿Cómo quieres que calculemos tus números?</p>
                    <div className="icon-grid">
                      {STRATEGIES.map(s => {
                        const locked = !isPro && !FREE_STRATEGIES.has(s.id);
                        return (
                        <button
                          key={s.id}
                          className={`icon-card ${wizardStrategy === s.id ? "selected" : ""} ${locked ? "locked-option" : ""}`}
                          onClick={() => {
                            if (locked) {
                              setShowPricingModal(true);
                              return;
                            }
                            setWizardStrategy(s.id);
                            setWizardTimeRange("180");
                            handleGenerate(s.id);
                          }}
                        >
                          <span className="icon-card-emoji">{s.icon}</span>
                          <span className="icon-card-label">{s.label}</span>
                          <span className="icon-card-desc">{s.desc}</span>
                          {locked && <span className="lock-chip">🔒 Pro</span>}
                        </button>
                      )})}
                    </div>
                    <button className="wizard-back" onClick={() => setWizardStep(1)}>← Volver</button>
                  </div>
                )}

                {/* STEP 3: TIME RANGE */}
                {wizardStep === 3 && (
                  <div className="wizard-step fade-in">
                    <h2 className="wizard-title">Rango de Fecha</h2>
                    <p className="wizard-subtitle">¿Cuántos días de historial quieres analizar?</p>
                    <div className="icon-grid cols-4">
                      {TIME_RANGES.map(t => (
                        <button
                          key={t.id}
                          className={`icon-card ${wizardTimeRange === t.id ? "selected" : ""}`}
                          onClick={() => setWizardTimeRange(t.id)}
                        >
                          <span className="icon-card-emoji">{t.icon}</span>
                          <span className="icon-card-label">
                            {t.label}
                            {t.id === "180" && <span style={{ fontSize: "0.7em", backgroundColor: "#ffcc00", color: "#000", padding: "2px 4px", borderRadius: "4px", marginLeft: "6px" }}>Recomendado</span>}
                          </span>
                        </button>
                      ))}
                    </div>

                    {wizardTimeRange && (
                      <button className="generate-btn" onClick={() => handleGenerate()} disabled={isRefreshing}>
                        {isRefreshing ? (
                          <span className="gen-loading">Calculando<span className="dots">...</span></span>
                        ) : (
                          <>Generar Mis Números ✨</>
                        )}
                      </button>
                    )}
                    <button className="wizard-back" onClick={() => setWizardStep(2)}>← Volver</button>
                  </div>
                )}
              </section>
            ) : (
              <div className="fade-in">
                <button className="wizard-back" onClick={resetWizard} style={{ marginBottom: "1.5rem" }}>
                  ← Nueva Generación
                </button>

                {wizardStrategy === "last_year" && currentAnalysis.lastYearDraw ? (
                  <section className="last-year-panel" style={{ marginTop: "1rem" }}>
                    <div>
                      <span className="panel-kicker">Sorteo del año pasado</span>
                      <h3>{currentAnalysis.lastYearDraw.date} - {currentAnalysis.lastYearDraw.draw}</h3>
                    </div>
                    <div className="last-year-prizes">
                      <div><span>1ro</span><strong>{currentAnalysis.lastYearDraw.first}</strong></div>
                      <div><span>2do</span><strong>{currentAnalysis.lastYearDraw.second}</strong></div>
                      <div><span>3ro</span><strong>{currentAnalysis.lastYearDraw.third}</strong></div>
                    </div>
                  </section>
                ) : (
                  <>
                    <h2 style={{ marginBottom: "0.5rem", fontSize: "1.3rem", lineHeight: "1.4" }}>
                      Tus recomendaciones para hoy {wizardDraw === "Gordito" ? "Gordito del Zodiaco" : wizardDraw === "Extraordinaria" ? "Sorteo Extraordinario" : wizardDraw} <br/>
                      <span style={{ fontSize: "1rem", color: "var(--color-primary)", fontWeight: "normal" }}>{new Date().toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </h2>
                    <p className="wizard-subtitle" style={{ marginBottom: "1.5rem" }}>
                      {DRAWS.find(d => d.id === wizardDraw)?.icon} {wizardDraw} • {STRATEGIES.find(s => s.id === wizardStrategy)?.icon} {STRATEGIES.find(s => s.id === wizardStrategy)?.label} • {wizardTimeRange} días
                    </p>

                    <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", justifyContent: "center" }}>
                      <button onClick={shareResults} style={{ padding: "0.5rem 1rem", borderRadius: "8px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold" }}>
                        📤 Compartir
                      </button>
                      <button onClick={downloadResults} style={{ padding: "0.5rem 1rem", borderRadius: "8px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold" }}>
                        ⬇️ Descargar
                      </button>
                    </div>

                    <div className="results-grid">
                      {displayPicks.map(({ pick, locked }, i) => {
                        const isFav = userFavs.includes(pick.term);
                        return (
                          <div 
                            key={`${pick.term}-${i}`} 
                            className={`result-card fade-in ${locked ? "locked-result" : ""}`} 
                            style={{ animationDelay: `${i * 0.06}s`, cursor: locked ? "pointer" : "default" }}
                            onClick={() => {
                              if (locked) setShowPricingModal(true);
                            }}
                          >
                            {locked && <div className="result-lock">🔒 Pro</div>}
                            <div className={locked ? "blurred-result" : ""}>
                              <div className="result-card-top">
                                <span className="result-number">{pick.term}</span>
                                <button className={`fav-btn ${isFav ? "active" : ""}`} onClick={() => !locked && toggleFavorite(pick.term)} disabled={locked}>
                                  {isFav ? "★" : "☆"}
                                </button>
                              </div>
                              <div className="result-score">
                                <span className="score-badge">Score {pick.score}</span>
                                {pick.recentSignal && <span className="hot-badge">HOT</span>}
                              </div>
                              <p className="result-reason">{pick.reason}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!isPro && (
                      <div style={{ textAlign: "center", margin: "30px 0" }}>
                        <p style={{ color: "var(--text-muted)", marginBottom: "16px", fontSize: "15px" }}>Los 7 números con mayor puntuación están en el plan Pro</p>
                        <a href={`https://payhip.com/buy?link=ih1Cy&email=${encodeURIComponent(profile.email)}`} className="payhip-buy-button premium-upgrade-btn" data-theme="green" data-product="ih1Cy" style={{ padding: "16px 32px", fontSize: "16px" }}>
                          🌟 Actualizar Ahora
                        </a>
                      </div>
                    )}

                    {isPro && (currentAnalysis.generatedTickets || []).length > 0 && (
                      <section className="ticket-suggestions">
                        <div>
                          <span className="panel-kicker">Billetes sugeridos</span>
                          <h3>5 jugadas de 4 numeros</h3>
                        </div>
                        <div className="ticket-suggestion-grid">
                          {(currentAnalysis.generatedTickets || []).map((ticket) => (
                            <span key={ticket}>{ticket}</span>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* PREVIOUS DRAW PANEL */}
              <div className="previous-draw-panel">
                <div className="glass-panel" style={{ padding: "24px", position: "sticky", top: "24px" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px", color: "#f8fafc" }}>
                    <span style={{ color: "#eab308" }}>🏆</span> Último Resultado
                  </h3>
                  {(() => {
                    const currentYear = new Date().getFullYear().toString();
                    const latestDraw = [...officialHistory].reverse().find(r => r.date.startsWith(currentYear));
                    const drawDisplayName: Record<string, string> = { Gordito: "Gordito del Zodíaco", Extraordinaria: "Sorteo Extraordinario", Miercolito: "Miercolito", Dominical: "Dominical" };
                    if (!latestDraw) return (
                      <div style={{ color: "#64748b", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>Cargando resultados...</div>
                    );
                    return (
                      <div>
                        <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "16px" }}>
                          {drawDisplayName[latestDraw.draw] || latestDraw.draw} — {latestDraw.date}
                        </div>
                        <div style={{ display: "grid", gap: "12px" }}>
                          <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>1er Premio</div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "2px" }}>{latestDraw.first} <span style={{ color: "var(--primary)", fontSize: "1.2rem" }}>{latestDraw.firstTerm}</span></div>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>2do Premio</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc", letterSpacing: "2px" }}>{latestDraw.second} <span style={{ color: "var(--primary)", fontSize: "1rem" }}>{latestDraw.secondTerm}</span></div>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>3er Premio</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc", letterSpacing: "2px" }}>{latestDraw.third} <span style={{ color: "var(--primary)", fontSize: "1rem" }}>{latestDraw.thirdTerm}</span></div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== STATS TAB ========== */}
        {activeTab === "stats" && (
          <div className="fade-in">
            <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
              <h2 style={{ marginBottom: "1rem" }}>Filtros de Estadísticas</h2>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                  <span style={{ fontSize: "0.9em", opacity: 0.8 }}>Sorteo</span>
                  <select value={statsDraw} onChange={e => setStatsDraw(e.target.value as DrawType)} style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "inherit" }}>
                    {availableDraws.map(d => <option key={d.id} value={d.id} style={{ color: "#000" }}>{d.label}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                  <span style={{ fontSize: "0.9em", opacity: 0.8 }}>Periodo</span>
                  <select value={statsTimeRange} onChange={e => setStatsTimeRange(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "inherit" }}>
                    {TIME_RANGES.map(t => <option key={t.id} value={t.id} style={{ color: "#000" }}>{t.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <h2 style={{ marginBottom: "0.5rem" }}>Frecuencia Reciente</h2>
            <p className="wizard-subtitle" style={{ marginBottom: "2rem" }}>
              Últimos {statsTimeRange} días — Top 5 calientes y 5 fríos
            </p>

            <div className="stats-bars-container">
              {isStatsLoading ? (
                <p className="wizard-subtitle">Cargando estadísticas...</p>
              ) : statsDisplay.length === 0 ? (
                <p className="wizard-subtitle">No hay suficientes datos para mostrar.</p>
              ) : (
                statsDisplay.map((stat, i) => {
                  const pct = Math.max(5, (stat.frequency / maxFreq) * 100);
                  const isHot = stat.label === "HOT";
                  return (
                    <div key={stat.term} className="stat-bar-row fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                      <span className="stat-bar-term">{stat.term}</span>
                      <div className="stat-bar-track">
                        <div
                          className={`stat-bar-fill ${isHot ? "hot" : "cold"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="stat-bar-freq">{stat.frequency}x</span>
                      <span className={`stat-bar-label ${isHot ? "hot" : "cold"}`}>
                        {stat.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========== FAVORITES TAB ========== */}
        {activeTab === "favorites" && (
          <div className="fade-in">
            <h2 style={{ marginBottom: "1.5rem" }}>Mis Favoritos</h2>
            {!isPro && (
              <button className="upgrade-banner" onClick={() => setShowPricingModal(true)}>
                Favoritos con historial de aciertos estan disponibles en Pro → Actualizar
              </button>
            )}
            {favoriteRows.length === 0 ? (
              <p className="wizard-subtitle">No has guardado ningún número todavía. Genera números y toca la ☆ para guardarlos.</p>
            ) : (
              <div className="results-grid">
                {favoriteRows.map((favorite, i) => (
                  <div key={favorite.term} className="result-card fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="result-card-top">
                      <span className="result-number">{favorite.term}</span>
                      <button className="fav-btn active" onClick={() => toggleFavorite(favorite.term)}>★</button>
                    </div>
                    <div className="result-score">
                      {favorite.pick && <span className="score-badge">Score {favorite.pick.score}</span>}
                      {isPro && <span className="hot-badge">{favorite.hits.length} aciertos</span>}
                    </div>
                    <p className="result-reason">
                      {isPro && favorite.hits.length > 0
                        ? `Ultimo acierto: ${favorite.hits.at(-1)?.date} en ${favorite.hits.at(-1)?.draw}.`
                        : favorite.pick?.reason || "Favorito guardado."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== TICKETS TAB ========== */}
        {activeTab === "tickets" && (
          <div className="fade-in">
            <section className="glass-panel" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
              <h2 style={{ marginBottom: "0.5rem" }}>Rastreador de Compras</h2>
              <p className="wizard-subtitle" style={{ marginBottom: "1.5rem" }}>Ingresa tu chance o billete y verificaremos automáticamente si ganaste.</p>

              <form onSubmit={addTicket} className="ticket-form-grid">
                <label>
                  <span>Fecha del Sorteo</span>
                  <input type="date" value={ticketDate} onChange={e => setTicketDate(e.target.value)} required />
                </label>
                <label>
                  <span>Sorteo</span>
                  <select value={ticketDraw} onChange={e => setTicketDraw(e.target.value as DrawType)}>
                    <option value="Miercolito">Miercolito</option>
                    <option value="Dominical">Dominical</option>
                    <option value="Gordito">Gordito del Zodiaco</option>
                    <option value="Extraordinaria">Extraordinaria</option>
                  </select>
                </label>
                <label>
                  <span>Número de Billete</span>
                  <input type="text" placeholder="Ej: 45 o 1234" value={ticketNumber} onChange={e => setTicketNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required />
                </label>
                <button type="submit" disabled={isAddingTicket}>
                  {isAddingTicket ? "..." : "Verificar"}
                </button>
              </form>
            </section>

            <h2 style={{ marginBottom: "1rem" }}>Historial de Billetes</h2>
            <div className="ticket-list">
              {userTickets.slice().reverse().map((t) => (
                <div key={t.id} className="ticket-item">
                  <div className="info">
                    <strong>{t.number}</strong>
                    <span>{t.draw} • {t.date}</span>
                  </div>
                  <div className={`status ${t.status.startsWith("win") ? "status-win" : t.status === "pending" ? "status-pending" : "status-lose"}`}>
                    {t.status === 'pending' && "Esperando..."}
                    {t.status === 'win_1st' && "1er Premio 🎉"}
                    {t.status === 'win_2nd' && "2do Premio"}
                    {t.status === 'win_3rd' && "3er Premio"}
                    {t.status === 'lose' && "No Ganador"}
                  </div>
                </div>
              ))}
              {userTickets.length === 0 && <p className="wizard-subtitle">No has registrado ningún billete.</p>}
            </div>
            {userTickets.length > 0 && (
              <button 
                onClick={clearTicketHistory} 
                style={{ 
                  marginTop: "1rem", 
                  padding: "0.5rem 1rem", 
                  borderRadius: "8px", 
                  background: "rgba(255,50,50,0.2)", 
                  border: "1px solid rgba(255,50,50,0.4)", 
                  color: "#ff8888", 
                  cursor: "pointer", 
                  width: "100%",
                  fontWeight: "bold"
                }}>
                🗑️ Limpiar Historial
              </button>
            )}
          </div>
        )}

        {/* ========== PROFILE TAB ========== */}
        {activeTab === "profile" && (
          <div className="fade-in">
            <div className="profile-header glass-panel">
              {profile.photo ? (
                <img src={profile.photo} alt="Avatar" className="avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="avatar">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              {!editingProfile ? (
                <>
                  <h2>{profile.name}</h2>
                  <p className="wizard-subtitle">{profile.email}</p>
                  <button className="primary-btn" onClick={() => {
                    setEditName(profile.name);
                    setEditPhoto(profile.photo || "");
                    setEditPassword("");
                    setEditingProfile(true);
                  }} style={{ marginTop: "1rem", padding: "8px 16px", fontSize: "0.9rem" }}>Editar Perfil</button>
                </>
              ) : (
                <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "1rem", width: "100%", maxWidth: "320px", alignItems: "center" }}>
                  <input type="text" className="glass-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre" style={{ width: "100%" }} />
                  
                  {/* Photo upload */}
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    {editPhoto ? (
                      <img src={editPhoto} alt="Preview" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(99,102,241,0.5)" }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", border: "2px dashed rgba(99,102,241,0.4)" }}>📷</div>
                    )}
                    <label htmlFor="photo-upload" style={{ cursor: "pointer", padding: "6px 14px", borderRadius: "8px", background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", fontSize: "0.85rem" }}>
                      {editPhoto ? "Cambiar foto" : "Subir foto"}
                    </label>
                    <input id="photo-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setEditPhoto(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }} />
                    {editPhoto && (
                      <button type="button" onClick={() => setEditPhoto("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.8rem" }}>Quitar foto</button>
                    )}
                  </div>

                  <input type="password" className="glass-input" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Nueva Contraseña (opcional)" style={{ width: "100%" }} />
                  <div style={{ display: "flex", gap: "10px", marginTop: "0.25rem" }}>
                    <button type="submit" className="primary-btn" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>Guardar</button>
                    <button type="button" className="secondary-btn" onClick={() => setEditingProfile(false)} style={{ padding: "8px 16px", fontSize: "0.9rem" }}>Cancelar</button>
                  </div>
                </form>
              )}
            </div>

            <div className="profile-stats-row">
              <div className="glass-panel profile-stat">
                <strong>{stats.totalTickets}</strong>
                <span>Billetes</span>
              </div>
              <div className="glass-panel profile-stat">
                <strong>{stats.totalWins}</strong>
                <span>Premios</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>Historial de Generaciones</h3>
              {(profile.generationHistory && profile.generationHistory.length > 0) && (
                <button className="secondary-btn" onClick={handleClearHistory} style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#fca5a5" }}>🗑️ Borrar Todo</button>
              )}
            </div>
            <div className="ticket-list">
              {(profile.generationHistory || []).slice().reverse().map((g, i) => (
                <div key={i} className="ticket-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div className="info" style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
                    <strong>{new Date(g.date).toLocaleDateString()} - {g.draw}</strong>
                    <span style={{ fontSize: "0.85em", opacity: 0.8 }}>
                      {g.timeRange} días | Estrategia: {STRATEGIES.find(s => s.id === g.strategy)?.label || g.strategy}
                    </span>
                  </div>
                  {g.strategy !== "last_year" ? (
                    <>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {g.picks.map(p => (
                          <span key={p} style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "12px", fontSize: "0.9em" }}>{p}</span>
                        ))}
                      </div>
                      {g.tickets && g.tickets.length > 0 && (
                        <div className="history-ticket-row">
                          <span>Billetes:</span>
                          {g.tickets.map(t => (
                            <strong key={t}>{t}</strong>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontStyle: "italic", opacity: 0.7, fontSize: "0.9em", padding: "4px 0" }}>
                      Sorteo histórico (Los resultados se muestran en el panel principal).
                    </div>
                  )}
                </div>
              ))}
              {(!profile.generationHistory || profile.generationHistory.length === 0) && (
                <p className="wizard-subtitle">No hay historial de generaciones.</p>
              )}
            </div>

            <button className="logout-btn" onClick={handleLogout} style={{ marginTop: "2rem" }}>
              Cerrar Sesión
            </button>

            <div style={{ marginTop: "3rem", padding: "1.5rem", borderRadius: "12px", border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.05)" }}>
              <h3 style={{ color: "#ef4444", margin: "0 0 1rem 0" }}>Zona de Peligro</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                Una vez que elimines tu cuenta, no hay vuelta atrás. Perderás tus billetes guardados, favoritos e historial de generaciones permanentemente.
              </p>
              <button onClick={handleDeleteAccount} style={{ padding: "10px 20px", background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                Eliminar cuenta permanentemente
              </button>
            </div>
          </div>
        )}

        {/* ===== PLACEHOLDER PANELS ===== */}
        {activeTab === "history" && (
          <div className="fade-in glass-panel" style={{ textAlign: "center", padding: "60px 20px" }}>
            <h2>📋 Todos los sorteos</h2>
            <p style={{ color: "var(--text-muted)", marginTop: "16px" }}>El historial completo de sorteos oficiales estará disponible aquí próximamente.</p>
          </div>
        )}
        {activeTab === "pyramids" && (
          <div className="fade-in glass-panel" style={{ textAlign: "center", padding: "60px 20px" }}>
            <h2>🔺 Pirámides</h2>
            <p style={{ color: "var(--text-muted)", marginTop: "16px" }}>La herramienta de cálculo de pirámides estará disponible próximamente.</p>
          </div>
        )}
        {activeTab === "dreams" && (
          <div className="fade-in glass-panel" style={{ padding: "40px 20px" }}>
            <h2 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#eab308" }}>🌙</span> Diccionario de sueños
            </h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>
              Busca el significado de tus sueños y descubre qué número jugar. Soporta palabras exactas o generación inteligente.
            </p>
            <div className="search-container" style={{ position: "relative", marginBottom: "32px" }}>
              <input 
                type="text" 
                value={dreamQuery}
                onChange={e => setDreamQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleDreamSearch()}
                placeholder="¿Qué soñaste hoy? Ej. Perro, agua, dinero..." 
                className="glass-input" 
                style={{ width: "100%", padding: "16px 20px", fontSize: "1rem", borderRadius: "12px" }}
              />
              <button onClick={handleDreamSearch} disabled={isDreamLoading} className="primary-btn" style={{ position: "absolute", right: "8px", top: "8px", padding: "8px 16px" }}>
                {isDreamLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px" }}>
              {dreamResults.length > 0 ? dreamResults.map((d, i) => (
                <div key={i} className="fade-in" style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "12px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f8fafc", marginBottom: "8px", textTransform: "capitalize" }}>{d.word}</div>
                  <div style={{ fontSize: "2.2rem", fontWeight: "800", color: "var(--primary)" }}>{d.number}</div>
                </div>
              )) : (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  No se encontraron resultados. Intenta con otra palabra.
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "alerts" && (
          <div className="fade-in glass-panel" style={{ padding: "40px 20px", maxWidth: "800px" }}>
            <h2 style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#eab308" }}>🔔</span> Configurar alertas
            </h2>
            <div>
              {[
                { id: "gordito", title: "Resultados del Gordito / Extraordinaria", desc: "Notificación cuando salgan los números de sorteos especiales", default: true },
                { id: "morning", title: "Generación en la mañana", desc: "Recordatorio para generar tus números antes del sorteo", default: true },
                { id: "dominical", title: "Sorteo dominical", desc: "Resultados de cada domingo", default: false },
                { id: "miercolito", title: "Miercolito", desc: "Resultados de cada miércoles", default: false },
                { id: "reminder", title: "Recordatorio antes del sorteo", desc: "1 hora antes de cada sorteo", default: true }
              ].map(alert => (
                <div key={alert.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ paddingRight: "16px" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 600 }}>{alert.title}</h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{alert.desc}</p>
                  </div>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={alertsState[alert.id] ?? alert.default} 
                      onChange={(e) => setAlertsState(prev => ({ ...prev, [alert.id]: e.target.checked }))} 
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "32px", textAlign: "right" }}>
              <button 
                onClick={handleSaveAlerts} 
                disabled={isSavingAlerts}
                style={{
                  padding: "12px 24px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: isSavingAlerts ? "wait" : "pointer",
                  opacity: isSavingAlerts ? 0.7 : 1
                }}
              >
                {isSavingAlerts ? "Guardando..." : "Guardar preferencias"}
              </button>
            </div>
          </div>
        )}
      </div>{/* end tab-content */}

      {/* ========== PRICING MODAL ========== */}
      {showPricingModal && (
        <div className="modal-overlay fade-in" onClick={() => setShowPricingModal(false)}>
          <div className="pricing-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowPricingModal(false)}>×</button>
            <h2 className="modal-title">Elige tu Plan</h2>
            <p className="modal-subtitle">Desbloquea todo el poder de la estadística y aumenta tus probabilidades.</p>
            <div className="pricing-cards">
              <div className="plan-card free">
                <h3>Plan Gratis</h3>
                <ul>
                  <li>✅ 2 Sorteos (Miercolito, Dominical)</li>
                  <li>✅ Estrategias Básicas</li>
                  <li>❌ Mejores 7 Números</li>
                  <li>❌ Estadísticas Avanzadas</li>
                  <li>❌ Sorteos Especiales</li>
                </ul>
                <button className="current-plan-btn" disabled>Tu plan actual</button>
              </div>
              <div className="plan-card pro">
                <h3>Plan Pro</h3>
                <ul>
                  <li>⭐ Todos los Sorteos (Gordito, Extraordinaria)</li>
                  <li>⭐ Estrategias Premium (Histórico, Brinco, etc.)</li>
                  <li>⭐ Top 10 Números Desbloqueados</li>
                  <li>⭐ Estadísticas Detalladas por Sorteo</li>
                  <li>⭐ Mis Favoritos con Historial de Aciertos</li>
                  <li>⭐ Alertas de Resultados del Sorteo</li>
                  <li>⭐ Generador y Rastreador de Billetes</li>
                  <li>⭐ Diccionario de Sueños</li>
                </ul>
                <a href={`https://payhip.com/buy?link=ih1Cy&email=${encodeURIComponent(profile.email)}`} className="payhip-buy-button premium-upgrade-btn" data-theme="green" data-product="ih1Cy" style={{ width: "100%", padding: "16px", display: "block", textAlign: "center" }}>
                  🚀 Actualizar a Pro
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
    </div>
  );
}
