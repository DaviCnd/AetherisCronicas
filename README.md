# Aetheris Crônicas

Segundo site do ecossistema Aetheris, separado do FichaAetheris.

## Esta versão v0.1 já possui

- login com a mesma conta do FichaAetheris;
- leitura das fichas mecânicas do jogador;
- criação de perfil narrativo ligado por `sheet_id`;
- documentos rich text com TipTap;
- criação de campanhas;
- entrada por código de convite;
- associação de personagem à campanha;
- rolagem básica de dados;
- Render + Turso.

## Como a conta é compartilhada

O projeto usa o MESMO banco Turso e lê a tabela `users` existente do FichaAetheris.
A senha não é duplicada.

As sessões do Crônicas ficam em `chronicles_sessions`, portanto não interferem no primeiro site.

## Rodar

```bash
npm run install:all
```

Copie `.env.example` para `server/.env` ou configure as variáveis diretamente.

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

Frontend: http://localhost:5173
Backend: http://localhost:3000

## Render

O `render.yaml` está incluído.

Configure:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`

Use o mesmo Turso do FichaAetheris.

## Próxima etapa planejada

v0.2:
- mapas interativos;
- grafo estilo Obsidian;
- árvore genealógica;
- entidades de lore;
- permissões refinadas de campanha;
- editor com mais fontes/cores/tabelas.
