"use strict";

require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { createDb, ensureSchema } = require("./db");

const app = express();
const db = createDb();
const production = process.env.NODE_ENV === "production";
const secret = process.env.JWT_SECRET || "dev-only-aetheris-cronicas-secret";

if (production && secret.length < 32) {
  throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres em produção.");
}

app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

if (!production) {
  app.use(cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true
  }));
}

app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function createSession(res, user) {
  const id = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

  await db.execute({
    sql: "INSERT INTO chronicles_sessions(id,user_id,expires_at) VALUES(?,?,?)",
    args: [id, Number(user.id), expires]
  });

  const token = jwt.sign(
    { id: Number(user.id), scope: "chronicles" },
    secret,
    { expiresIn: "30d", jwtid: id, algorithm: "HS256" }
  );

  res.cookie("chronicles_token", token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    maxAge: 30 * 24 * 3600 * 1000,
    path: "/"
  });

  return { id: Number(user.id), username: user.username };
}

const auth = wrap(async (req, res, next) => {
  try {
    const payload = jwt.verify(req.cookies.chronicles_token, secret, {
      algorithms: ["HS256"]
    });

    const r = await db.execute({
      sql: `
        SELECT users.id,users.username
        FROM users
        JOIN chronicles_sessions cs ON cs.user_id=users.id
        WHERE users.id=? AND cs.id=? AND cs.expires_at>unixepoch()
      `,
      args: [payload.id, payload.jti]
    });

    if (!r.rows.length) throw new Error();
    req.user = r.rows[0];
    req.sessionId = payload.jti;
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
});

app.post("/api/login", wrap(async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ error: "Informe usuário e senha." });
  }

  const r = await db.execute({
    sql: "SELECT id,username,password_hash FROM users WHERE username=?",
    args: [username]
  });

  const user = r.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Usuário ou senha inválidos." });
  }

  res.json(await createSession(res, user));
}));

app.get("/api/me", auth, (req, res) => {
  res.json({ id: Number(req.user.id), username: req.user.username });
});

app.post("/api/logout", auth, wrap(async (req, res) => {
  await db.execute({
    sql: "DELETE FROM chronicles_sessions WHERE id=?",
    args: [req.sessionId]
  });
  res.clearCookie("chronicles_token", { path: "/" });
  res.json({ ok: true });
}));

app.get("/api/mechanical-sheets", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: "SELECT id,name,data,updated_at FROM sheets WHERE user_id=? ORDER BY updated_at DESC",
    args: [req.user.id]
  });

  res.json(r.rows.map((row) => {
    let d = {};
    try { d = JSON.parse(row.data); } catch {}
    return {
      id: Number(row.id),
      name: row.name,
      updated_at: row.updated_at,
      summary: {
        level: d?.state?.level || 1,
        race: d?.state?.race || "",
        profession: d?.state?.profession || "",
        region: d?.fields?.["f-regiao"] || "",
        avatar: d?.state?.avatarData || ""
      }
    };
  }));
}));

app.get("/api/profiles", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: "SELECT * FROM lore_profiles WHERE user_id=? ORDER BY updated_at DESC",
    args: [req.user.id]
  });
  res.json(r.rows);
}));

app.post("/api/profiles", auth, wrap(async (req, res) => {
  const name = String(req.body?.display_name || "").trim();
  const sheetId = req.body?.sheet_id ? Number(req.body.sheet_id) : null;

  if (!name) return res.status(400).json({ error: "Informe o nome." });

  if (sheetId) {
    const sheet = await db.execute({
      sql: "SELECT id FROM sheets WHERE id=? AND user_id=?",
      args: [sheetId, req.user.id]
    });
    if (!sheet.rows.length) {
      return res.status(403).json({ error: "Ficha mecânica inválida." });
    }
  }

  const r = await db.execute({
    sql: "INSERT INTO lore_profiles(user_id,sheet_id,display_name,summary) VALUES(?,?,?,?)",
    args: [req.user.id, sheetId, name, String(req.body?.summary || "")]
  });

  res.json({ id: Number(r.lastInsertRowid) });
}));

app.get("/api/documents", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: `
      SELECT id,profile_id,campaign_id,title,visibility,updated_at
      FROM chronicles_documents
      WHERE owner_user_id=?
      ORDER BY updated_at DESC
    `,
    args: [req.user.id]
  });
  res.json(r.rows);
}));

app.get("/api/documents/:id", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: "SELECT * FROM chronicles_documents WHERE id=? AND owner_user_id=?",
    args: [req.params.id, req.user.id]
  });

  if (!r.rows.length) {
    return res.status(404).json({ error: "Documento não encontrado." });
  }

  const doc = r.rows[0];
  res.json({ ...doc, content_json: JSON.parse(doc.content_json || "{}") });
}));

app.post("/api/documents", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: `
      INSERT INTO chronicles_documents(owner_user_id,profile_id,campaign_id,title,content_json,visibility)
      VALUES(?,?,?,?,?,?)
    `,
    args: [
      req.user.id,
      req.body?.profile_id || null,
      req.body?.campaign_id || null,
      String(req.body?.title || "Sem título"),
      JSON.stringify(req.body?.content_json || { type: "doc", content: [] }),
      String(req.body?.visibility || "private")
    ]
  });

  res.json({ id: Number(r.lastInsertRowid) });
}));

app.put("/api/documents/:id", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: `
      UPDATE chronicles_documents
      SET title=?,content_json=?,visibility=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND owner_user_id=?
    `,
    args: [
      String(req.body?.title || "Sem título"),
      JSON.stringify(req.body?.content_json || {}),
      String(req.body?.visibility || "private"),
      req.params.id,
      req.user.id
    ]
  });

  if (!r.rowsAffected) {
    return res.status(404).json({ error: "Documento não encontrado." });
  }

  res.json({ ok: true });
}));

function inviteCode() {
  return crypto.randomBytes(5).toString("base64url").toUpperCase();
}

app.get("/api/campaigns", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: `
      SELECT c.*,m.role
      FROM chronicles_campaigns c
      JOIN chronicles_campaign_members m ON m.campaign_id=c.id
      WHERE m.user_id=?
      ORDER BY c.id DESC
    `,
    args: [req.user.id]
  });
  res.json(r.rows);
}));

app.post("/api/campaigns", auth, wrap(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Informe o nome da campanha." });

  const code = inviteCode();
  const r = await db.execute({
    sql: "INSERT INTO chronicles_campaigns(owner_user_id,name,description,invite_code) VALUES(?,?,?,?)",
    args: [req.user.id, name, String(req.body?.description || ""), code]
  });

  const id = Number(r.lastInsertRowid);

  await db.execute({
    sql: "INSERT INTO chronicles_campaign_members(campaign_id,user_id,role) VALUES(?,?,?)",
    args: [id, req.user.id, "master"]
  });

  res.json({ id, invite_code: code });
}));

app.post("/api/campaigns/join", auth, wrap(async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();

  const c = await db.execute({
    sql: "SELECT id FROM chronicles_campaigns WHERE invite_code=?",
    args: [code]
  });

  if (!c.rows.length) return res.status(404).json({ error: "Convite inválido." });

  await db.execute({
    sql: `
      INSERT OR IGNORE INTO chronicles_campaign_members(campaign_id,user_id,role)
      VALUES(?,?,?)
    `,
    args: [c.rows[0].id, req.user.id, "player"]
  });

  res.json({ ok: true, campaign_id: Number(c.rows[0].id) });
}));

app.get("/api/campaigns/:id/characters", auth, wrap(async (req, res) => {
  const campaignId = Number(req.params.id);

  const access = await db.execute({
    sql: "SELECT role FROM chronicles_campaign_members WHERE campaign_id=? AND user_id=?",
    args: [campaignId, req.user.id]
  });
  if (!access.rows.length) return res.status(403).json({ error: "Sem acesso." });

  const r = await db.execute({
    sql: `
      SELECT p.id,p.display_name,p.summary,p.avatar,cc.user_id
      FROM chronicles_campaign_characters cc
      JOIN lore_profiles p ON p.id=cc.profile_id
      WHERE cc.campaign_id=?
      ORDER BY p.display_name
    `,
    args: [campaignId]
  });

  res.json(r.rows);
}));

app.post("/api/campaigns/:id/characters", auth, wrap(async (req, res) => {
  const campaignId = Number(req.params.id);
  const profileId = Number(req.body?.profile_id);

  const access = await db.execute({
    sql: "SELECT role FROM chronicles_campaign_members WHERE campaign_id=? AND user_id=?",
    args: [campaignId, req.user.id]
  });
  if (!access.rows.length) return res.status(403).json({ error: "Sem acesso." });

  const profile = await db.execute({
    sql: "SELECT id FROM lore_profiles WHERE id=? AND user_id=?",
    args: [profileId, req.user.id]
  });
  if (!profile.rows.length) return res.status(403).json({ error: "Personagem inválido." });

  await db.execute({
    sql: `
      INSERT OR IGNORE INTO chronicles_campaign_characters(campaign_id,profile_id,user_id)
      VALUES(?,?,?)
    `,
    args: [campaignId, profileId, req.user.id]
  });

  res.json({ ok: true });
}));

function rollDice(expression) {
  const expr = String(expression || "").trim().toLowerCase();
  const m = expr.match(/^(\d{1,2})d(\d{1,4})([+-]\d{1,4})?$/);

  if (!m) throw new Error("Use 1d20, 2d6+3, 1d100-10 etc.");

  const count = Number(m[1]);
  const sides = Number(m[2]);
  const modifier = Number(m[3] || 0);

  if (count < 1 || count > 50 || sides < 2 || sides > 1000) {
    throw new Error("Rolagem fora dos limites.");
  }

  const rolls = Array.from(
    { length: count },
    () => 1 + Math.floor(Math.random() * sides)
  );

  const result = rolls.reduce((a, b) => a + b, 0) + modifier;
  const detail = `${rolls.join(" + ")}${modifier ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ""}`;

  return { expression: expr, rolls, modifier, result, detail };
}

app.get("/api/campaigns/:id/rolls", auth, wrap(async (req, res) => {
  const r = await db.execute({
    sql: `
      SELECT dr.*,u.username
      FROM chronicles_dice_rolls dr
      JOIN users u ON u.id=dr.user_id
      JOIN chronicles_campaign_members m
        ON m.campaign_id=dr.campaign_id AND m.user_id=?
      WHERE dr.campaign_id=?
      ORDER BY dr.id DESC
      LIMIT 100
    `,
    args: [req.user.id, req.params.id]
  });
  res.json(r.rows);
}));

app.post("/api/campaigns/:id/roll", auth, wrap(async (req, res) => {
  const campaignId = Number(req.params.id);

  const access = await db.execute({
    sql: "SELECT role FROM chronicles_campaign_members WHERE campaign_id=? AND user_id=?",
    args: [campaignId, req.user.id]
  });
  if (!access.rows.length) return res.status(403).json({ error: "Sem acesso." });

  let roll;
  try {
    roll = rollDice(req.body?.expression);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const r = await db.execute({
    sql: `
      INSERT INTO chronicles_dice_rolls(campaign_id,user_id,expression,result,detail)
      VALUES(?,?,?,?,?)
    `,
    args: [campaignId, req.user.id, roll.expression, roll.result, roll.detail]
  });

  res.json({ id: Number(r.lastInsertRowid), ...roll });
}));

if (production) {
  const dist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(dist));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

ensureSchema(db)
  .then(() => {
    app.listen(Number(process.env.PORT || 3000), () => {
      console.log("Aetheris Crônicas iniciado.");
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
