import ollama, { type Message } from "ollama";
import { Client } from "tmi.js";

import {
  adicionarMensagem,
  filtrarPorTermo,
  garantirUsuario,
  ultimasMensagens,
} from "./db.ts";
import { env } from "./env.ts";

const NOME_BOT = env.twitchUser;
const SEGUNDOS_POR_DIA = 86400;
const PERSONALIDADE =
  "1.Você é um bot da minha twitch (lixeirodaesquina:criador) chamado SacoDeLlxo. 2. Você responde perguntas sempre em Português do Brasil. 3. Você deve responder de forma criativa, mas de forma curta para não dar spam no chat. 4. Você comumente usa o emote ' majino11GatoAssimetrico ' que é um gato sorrindo igual como o emote ( ͡° ͜ʖ ͡°) quando quer mostrar que está feliz. Quando for usar coloque junto a sua mensagem, exemplo: Tudo certo patrão majino11GatoAssimetrico. 5. Você fala sobre lixo na maior parte do tempo com trocadilhos, é sua especialidade. 6. Se for usar outros emotes use emotes de texto ;) B) :) >( O_o :D :| :/ :O ;P :P :( R) <3 ";

const RESUMIR =
  "Você vai receber uma serie de mensagens de um chat da twitch que ocorreram entre ontem e hoje. Você deve resumir os acontencimentos mais relevantes em um texto breve indicando os acontencimentos e quem ou o que falou e sobre o que. Comece sua resposta com: Tudo o que rolou nas ultimas mensagens:";

const MODEL = env.ollamaModel;
const RESUMO_CACHE_MS = 5 * 60 * 1000;

const tools = [
  {
    type: "function",
    function: {
      name: "filtrarPorTermo",
      description: "Filtre mensagens por um termo especifico",
      parameters: {
        type: "object",
        required: ["termo"],
        properties: {
          termo: {
            type: "string",
            description: "Termo que deve ser procurado nas mensagens",
          },
        },
      },
    },
  },
];

let resumoCache: { conteudo: string; atualizadoEm: number } | undefined;
let resumoEmAndamento: Promise<string> | undefined;

const gerarResumoMensagens = async (): Promise<string> => {
  const agora = Math.floor(Date.now() / 1000);
  const inicioDeOntem =
    Math.floor(agora / SEGUNDOS_POR_DIA) * SEGUNDOS_POR_DIA - SEGUNDOS_POR_DIA;

  const response = await ollama.chat({
    model: MODEL,
    think: false,
    messages: [
      { role: "system", content: RESUMIR },
      {
        role: "user",
        content: JSON.stringify(ultimasMensagens(inicioDeOntem, agora)),
      },
    ],
  });
  return response.message.content;
};

const resumirMensagens = async (): Promise<string> => {
  if (resumoCache && Date.now() - resumoCache.atualizadoEm < RESUMO_CACHE_MS) {
    return resumoCache.conteudo;
  }

  resumoEmAndamento ??= gerarResumoMensagens()
    .then((conteudo) => {
      resumoCache = { conteudo, atualizadoEm: Date.now() };
      return conteudo;
    })
    .finally(() => {
      resumoEmAndamento = undefined;
    });

  return resumoEmAndamento;
};

const chat = async (msg: string): Promise<string> => {
  const messages: Message[] = [
    {
      role: "system",
      content: `${PERSONALIDADE}\n${await resumirMensagens()}`,
    },
    { role: "user", content: msg },
  ];

  const response = await ollama.chat({
    model: MODEL,
    think: false,
    tools,
    messages,
  });

  messages.push(response.message as Message);

  const toolCall = response.message.tool_calls?.[0];
  if (toolCall) {
    if (toolCall.function.name !== "filtrarPorTermo") {
      throw new Error(`Tool desconhecida: ${toolCall.function.name}`);
    }

    const { termo } = toolCall.function.arguments as { termo: string };
    const resultado = filtrarPorTermo(termo);
    messages.push({
      role: "tool",
      tool_name: toolCall.function.name,
      content: JSON.stringify(resultado),
    } as Message);

    const respostaFinal = await ollama.chat({
      model: MODEL,
      messages,
      tools,
      think: true,
    });
    return respostaFinal.message.content;
  }

  return response.message.content;
};

const client = new Client({
  identity: {
    username: env.twitchUser,
    password: env.twitchKey,
  },
  channels: env.twitchChannels,
});

const bot = garantirUsuario(NOME_BOT);

const MESSAGE_INTERVAL_MS = 2000;
const FILA: {
  channel: string;
  username: string;
  message: string;
}[] = [];
let processandoFila = false;

const esperar = (ms: number | undefined) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function processarFila() {
  if (processandoFila) return;

  processandoFila = true;
  try {
    while (FILA.length > 0) {
      const item = FILA.shift();
      if (!item) continue;

      try {
        const resposta = await chat(item.message);
        await client.say(item.channel, resposta);
        adicionarMensagem(bot.id, resposta);
        console.log(NOME_BOT, resposta);
      } catch (e) {
        console.log("Erro", e);
      }

      if (FILA.length > 0) {
        await esperar(MESSAGE_INTERVAL_MS);
      }
    }
  } finally {
    processandoFila = false;
  }
}

client.connect();

async function main() {
  client.on("message", (channel, tags, message, self) => {
    if (self) return;

    try {
      if (typeof tags.username !== "string") return;

      const usuario = garantirUsuario(tags.username);
      adicionarMensagem(usuario.id, message);
      console.log(usuario.name, message);

      if (!message.toLowerCase().includes(`@${NOME_BOT}`)) return;

      FILA.push({ channel, username: usuario.name, message });
      void processarFila();
    } catch (e) {
      console.log("Erro", e);
    }
  });
}

await main();
