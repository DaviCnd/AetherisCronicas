import React, { useEffect, useState } from "react";
import { api } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/me").then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center">Abrindo as Crônicas…</div>;
  if (!me) return <Login onLogin={setMe} />;

  return (
    <Dashboard
      me={me}
      onLogout={async () => {
        await api("/api/logout", { method: "POST" });
        setMe(null);
      }}
    />
  );
}
