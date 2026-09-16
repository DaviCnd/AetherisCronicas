import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import Documents from "../components/Documents";
import Campaigns from "../components/Campaigns";

export default function Dashboard({ me, onLogout }) {
  const [tab, setTab] = useState("characters");
  const [sheets, setSheets] = useState([]);
  const [profiles, setProfiles] = useState([]);

  async function refresh() {
    const [s, p] = await Promise.all([
      api("/api/mechanical-sheets"),
      api("/api/profiles")
    ]);
    setSheets(s);
    setProfiles(p);
  }

  useEffect(() => { refresh(); }, []);

  async function createProfile(sheet) {
    const display_name = prompt("Nome do perfil narrativo:", sheet.name);
    if (!display_name) return;

    await api("/api/profiles", {
      method: "POST",
      body: JSON.stringify({
        sheet_id: sheet.id,
        display_name
      })
    });

    refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <span className="eyebrow">AETHERIS</span>
          <h2>Crônicas</h2>
        </div>

        <nav>
          <button className={tab === "characters" ? "active" : ""} onClick={() => setTab("characters")}>Personagens</button>
          <button className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>Documentos</button>
          <button className={tab === "campaigns" ? "active" : ""} onClick={() => setTab("campaigns")}>Campanhas</button>
          <button disabled>Mapas · v0.2</button>
          <button disabled>Grafo · v0.2</button>
          <button disabled>Genealogia · v0.2</button>
        </nav>

        <div className="account">
          <span>{me.username}</span>
          <button onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <main className="workspace">
        {tab === "characters" && (
          <>
            <header className="page-head">
              <span className="eyebrow">PERSONAGENS</span>
              <h1>Arquivos pessoais</h1>
              <p className="muted">As fichas continuam no FichaAetheris. Aqui nasce a história.</p>
            </header>

            <div className="cards">
              {sheets.map(sheet => {
                const linked = profiles.find(p => Number(p.sheet_id) === Number(sheet.id));
                return (
                  <article className="card" key={sheet.id}>
                    <div className="avatar">
                      {sheet.summary.avatar ? <img src={sheet.summary.avatar} alt="" /> : "✦"}
                    </div>
                    <h3>{sheet.name}</h3>
                    <p className="muted">
                      {sheet.summary.race || "Raça não definida"} · {sheet.summary.profession || "Sem profissão"} · Nível {sheet.summary.level}
                    </p>
                    <p className="muted">{sheet.summary.region || "Origem não definida"}</p>
                    {linked
                      ? <span className="badge">Perfil narrativo criado</span>
                      : <button className="primary" onClick={() => createProfile(sheet)}>Criar perfil narrativo</button>
                    }
                  </article>
                );
              })}
            </div>
          </>
        )}

        {tab === "documents" && <Documents profiles={profiles} />}
        {tab === "campaigns" && <Campaigns profiles={profiles} />}
      </main>
    </div>
  );
}
