const fs = require('fs');
let code = fs.readFileSync('src/app/lotteryx-client.tsx', 'utf8');

// 1. Update Profile type
code = code.replace('  generationHistory?: GenerationRecord[];\n};', '  generationHistory?: GenerationRecord[];\n  photo?: string;\n};');

// 2. Add state hooks
code = code.replace(
  'const [profile, setProfile] = useState<Profile | null>(null);',
  'const [profile, setProfile] = useState<Profile | null>(null);\n  const [editingProfile, setEditingProfile] = useState(false);\n  const [editName, setEditName] = useState("");\n  const [editPhoto, setEditPhoto] = useState("");\n  const [editPassword, setEditPassword] = useState("");'
);

// 3. Add handleUpdateProfile
const handleUpdateProfileCode = `
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const body: any = {};
    if (editName.trim() && editName !== profile.name) body.name = editName.trim();
    if (editPhoto.trim() && editPhoto !== profile.photo) body.photo = editPhoto.trim();
    if (editPassword.trim()) body.password = editPassword.trim();
    
    if (Object.keys(body).length === 0) {
      setEditingProfile(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${profile.token}\` },
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
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${profile.token}\` },
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
`;
code = code.replace('  const handleLogout = () => {', handleUpdateProfileCode + '\n  const handleLogout = () => {');

// 4. Update Profile Tab JSX
const oldProfileTab = `<div className="profile-header glass-panel">
              <div className="avatar">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <h2>{profile.name}</h2>
              <p className="wizard-subtitle">{profile.email}</p>
            </div>`;

const newProfileTab = `<div className="profile-header glass-panel">
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
                <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "1rem", width: "100%", maxWidth: "300px", alignItems: "center" }}>
                  <input type="text" className="glass-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre" style={{ width: "100%" }} />
                  <input type="text" className="glass-input" value={editPhoto} onChange={e => setEditPhoto(e.target.value)} placeholder="URL de Foto (opcional)" style={{ width: "100%" }} />
                  <input type="password" className="glass-input" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Nueva Contraseña (opcional)" style={{ width: "100%" }} />
                  <div style={{ display: "flex", gap: "10px", marginTop: "0.5rem" }}>
                    <button type="submit" className="primary-btn" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>Guardar</button>
                    <button type="button" className="secondary-btn" onClick={() => setEditingProfile(false)} style={{ padding: "8px 16px", fontSize: "0.9rem" }}>Cancelar</button>
                  </div>
                </form>
              )}
            </div>`;
code = code.replace(oldProfileTab, newProfileTab);

// 5. Add handleClearHistory button
const oldHistorial = `<h3 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Historial de Generaciones</h3>`;
const newHistorial = `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>Historial de Generaciones</h3>
              {(profile.generationHistory && profile.generationHistory.length > 0) && (
                <button className="secondary-btn" onClick={handleClearHistory} style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#fca5a5" }}>🗑️ Borrar Todo</button>
              )}
            </div>`;
code = code.replace(oldHistorial, newHistorial);

fs.writeFileSync('src/app/lotteryx-client.tsx', code);
