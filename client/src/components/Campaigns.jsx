import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Campaigns({ profiles }) {
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [expression, setExpression] = useState("1d20");

  async function refresh() {
    setCampaigns(await api("/api/campaigns"));
  }

  useEffect(() => { refresh(); }, []);

  async function create() {
    const name = prompt("Nome da campanha:");
    if (!name) return;
    await api("/api/campaigns", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    refresh();
  }

  async function join() {
    const code = prompt("Código do convite:");
    if (!code) return;
    await api("/api/campaigns/join", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    refresh();
  }

  async function open(campaign) {
    setSelected(campaign);
    const [chars, history] = await Promise.all([
      api(`/api/campaigns/${campaign.id}/characters`),
      api(`/api/campaigns/${campaign.id}/rolls`)
    ]);
    setCharacters(chars);
    setRolls(history);
  }

  async function addCharacter() {
    if (!profiles.length) return alert("Crie um perfil narrativo primeiro.");

    const options = profiles.map(p => `${p.id}: ${p.display_name}`).join("\n");
    const profile_id = Number(prompt(`Escolha pelo ID:\n${options}`, profiles[0].id));
    if (!profile_id) return;

    await api(`/api/campaigns/${selected.id}/characters`, {
      method: "POST",
      body: JSON.stringify({ profile_id })
    });

    open(selected);
  }

  async function roll() {
    await api(`/api/campaigns/${selected.id}/roll`, {
      method: "POST",
      body: JSON.stringify({ expression })
    });
    open(selected);
  }

  return (
    <section>
      <header className="page-head row-between">
        <div>
          <span className="eyebrow">CAMPANHAS</span>
          <h1>Mundos compartilhados</h1>
        </div>
        <div className="row">
          <button onClick={join}>Entrar por convite</button>
          <button className="primary" onClick={create}>Criar campanha</button>
        </div>
      </header>

      <div className="cards">
        {campaigns.map(c => (
          <article className="card clickable" key={c.id} onClick={() => open(c)}>
            <span className="eyebrow">{c.role === "master" ? "MESTRE" : "JOGADOR"}</span>
            <h3>{c.name}</h3>
            <p className="muted">{c.description || "Sem descrição."}</p>
            <span className="badge">Convite: {c.invite_code}</span>
          </article>
        ))}
      </div>

      {selected && (
        <section className="campaign-room">
          <div className="row-between">
            <div>
              <span className="eyebrow">SALA</span>
              <h2>{selected.name}</h2>
            </div>
            <button onClick={addCharacter}>Adicionar personagem</button>
          </div>

          <div className="two-cols">
            <div className="panel">
              <h3>Personagens</h3>
              {characters.map(c => <div className="line" key={c.id}>{c.display_name}</div>)}
            </div>

            <div className="panel">
              <h3>Dados</h3>
              <div className="row">
                <input value={expression} onChange={e => setExpression(e.target.value)} />
                <button className="primary" onClick={roll}>Rolar</button>
              </div>

              <div className="rolls">
                {rolls.map(r => (
                  <div key={r.id}>
                    <strong>{r.username}</strong> · {r.expression} = <b>{r.result}</b>
                    <small>{r.detail}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
