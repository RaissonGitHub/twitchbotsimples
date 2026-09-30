import Database from "better-sqlite3";

import { env } from "./env.ts";

const db = new Database(env.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS MESSAGES (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USERS(id)
  );

  CREATE TABLE IF NOT EXISTS USERS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));

  CREATE INDEX IF NOT EXISTS mensagens_data ON MESSAGES(created_at DESC);
  CREATE INDEX IF NOT EXISTS mensagens_usuario_data ON MESSAGES(user_id, created_at DESC);
`);

type Usuario = {
  id: number;
  name: string;
  created_at: number;
};

type Mensagem = {
  id: number;
  message: string;
  created_at: number;
  user_id: number;
};

type MensagemComUsuario = Mensagem & { name: string };

function consultarUsuario(name: string): Usuario | undefined {
  const select = db.prepare<[string], Usuario>(`SELECT* FROM USERS WHERE name = ?`);
  return select.get(name);
}


function garantirUsuario(name: string): Usuario {
  db.prepare(`INSERT INTO USERS (name) VALUES (?) ON CONFLICT (name) DO NOTHING`).run(name);
  const usuario = consultarUsuario(name);
  if (!usuario) {
    throw new Error(`não foi possível consultar o usuário "${name}"`);
  }
  return usuario;
}

function adicionarMensagem(user_id: number, message: string): boolean {
  try {
    db.prepare<[number, string]>(
      "INSERT INTO MESSAGES (user_id, message) VALUES (?,?)",
    ).run(user_id, message);
    return true;
  } catch (e) {
    console.log("Erro", e);
    return false;
  }
}

function filtrarPorTermo(termo: string): MensagemComUsuario[] {
  try {
    return db
      .prepare<
        [string],
        MensagemComUsuario
      >("SELECT m.id, m.message, m.created_at, m.user_id, s.name FROM MESSAGES AS m INNER JOIN USERS AS s ON s.id = m.user_id WHERE m.message LIKE ? ORDER BY m.created_at DESC LIMIT 30;")
      .all(`%${termo}%`);
  } catch (e) {
    console.log("Erro", e);
    return [];
  }
}

function ultimasMensagens(inicio: number, fim: number): Mensagem[] {
  if (inicio > fim) {
    throw new RangeError("inicio não pode ser maior que fim");
  }

  const select = db.prepare<[number, number], Mensagem>(`
    SELECT id, message, created_at, user_id
    FROM MESSAGES
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC
    LIMIT 30;
  `);

  return select.all(inicio, fim);
}

export {
  adicionarMensagem,
  consultarUsuario,
  garantirUsuario,
  ultimasMensagens,
  filtrarPorTermo,
};
