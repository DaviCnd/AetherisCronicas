"use strict";

const path = require("path");
const { createClient } = require("@libsql/client");

function createDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, "cronicas.db")}`,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
}

async function ensureSchema(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chronicles_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS lore_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sheet_id INTEGER,
      display_name TEXT NOT NULL,
      summary TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chronicles_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      profile_id INTEGER,
      campaign_id INTEGER,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL DEFAULT '{}',
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chronicles_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      invite_code TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chronicles_campaign_members (
      campaign_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (campaign_id,user_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chronicles_campaign_characters (
      campaign_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (campaign_id,profile_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chronicles_dice_rolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      expression TEXT NOT NULL,
      result INTEGER NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { createDb, ensureSchema };
