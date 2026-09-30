# twitchbotsimples

Bot de Twitch que responde no chat usando um modelo local via [Ollama](https://ollama.com).

## Requisitos

- Node.js >= 22.6 (o projeto roda TypeScript direto, sem build)
- [Ollama](https://ollama.com) instalado com o modelo de `OLLAMA_MODEL` (`ollama pull qwen3:8b`)

## Configuração

Copie `.env.example` para `.env` e preencha:

| Variável         | Descrição                                              |
| ---------------- | ------------------------------------------------------ |
| `TWITCHKEY`      | Token de autenticação do chat, com escopo de escrita   |
| `TWITCH_USER`    | Usuário do bot (o mesmo que autentica com `TWITCHKEY`) |
| `TWITCH_CHANNELS`| Canais para entrar, separados por vírgula              |
| `OLLAMA_MODEL`   | Modelo do Ollama                                       |
| `DB_PATH`        | Caminho do banco SQLite                                |

 As cinco variáveis são obrigatórias: o bot não sobe sem elas.

Detalhes que economizam tempo:

- Usuário e canais são normalizados: `TWITCH_USER=@SacoDeLlxo` e `TWITCH_CHANNELS=Mjinow, Outro` viram `sacodellxo` e `["mjinow","outro"]`. Se usar `#` nos canais, coloque o valor entre aspas — sem aspas o `#` inicia um comentário e o valor chega vazio.
- `DB_PATH` é relativo ao diretório de execução, e o diretório precisa já existir.
- Variáveis passadas no ambiente têm precedência sobre o `.env`, útil para rodar com outro banco sem editar o arquivo.

## Uso

```bash
npm install
npm start          # roda o bot
npm run dev        # roda com watch
npm run typecheck  # checa os tipos
```

## Como funciona

- `api/index.ts` — conecta no chat, grava cada mensagem e, quando alguém menciona o bot, enfileira a pergunta. As respostas saem uma a uma, com 2s de intervalo.
- `api/db.ts` — banco SQLite no caminho de `DB_PATH`, criado automaticamente. Guarda mensagens em `MESSAGES` e usuários em `USERS`; `created_at` é um timestamp em epoch (segundos).
- `api/env.ts` — lê e valida o `.env`.

Cada resposta inclui um resumo do chat das últimas 24h, gerado a partir das mensagens do banco e guardado em cache por 5 minutos.

## Atenção

- O banco não é versionado (`.gitignore` cobre `*.sqlite`).
- Se o Ollama estiver fora do ar, as respostas falham, mas as mensagens continuam sendo gravadas normalmente.
