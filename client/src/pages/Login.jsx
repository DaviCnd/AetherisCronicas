import React, { useState } from "react";
import { api } from "../lib/api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      onLogin(await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="sigil">✦</div>
        <span className="eyebrow">AETHERIS · CRÔNICAS</span>
        <h1>Histórias deixam marcas.</h1>
        <p className="muted">Entre com a mesma conta do FichaAetheris.</p>

        <label>Usuário<input value={username} onChange={e => setUsername(e.target.value)} /></label>
        <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary">Entrar</button>
      </form>
    </main>
  );
}
