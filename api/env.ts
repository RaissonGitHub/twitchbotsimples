import { loadEnvFile } from "node:process";

loadEnvFile();

function obrigatorio(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    throw new Error(`${nome} não foi definida no arquivo .env`);
  }
  return valor;
}

const twitchUser = obrigatorio("TWITCH_USER")
  .replace(/^@/, "")
  .toLowerCase();

const twitchChannels = obrigatorio("TWITCH_CHANNELS")
  .split(",")
  .map((canal) => canal.trim().replace(/^#/, "").toLowerCase())
  .filter((canal) => canal.length > 0);

if (twitchChannels.length === 0) {
  throw new Error("TWITCH_CHANNELS precisa de pelo menos um canal");
}

export const env = {
  twitchKey: obrigatorio("TWITCHKEY"),
  twitchUser,
  twitchChannels,
  ollamaModel: obrigatorio("OLLAMA_MODEL"),
  dbPath: obrigatorio("DB_PATH"),
};
