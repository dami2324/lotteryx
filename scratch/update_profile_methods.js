const fs = require('fs');
let code = fs.readFileSync('src/app/lotteryx-client.tsx', 'utf8');

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
code = code.replace('  function handleLogout() {', handleUpdateProfileCode + '\n  function handleLogout() {');

fs.writeFileSync('src/app/lotteryx-client.tsx', code);
