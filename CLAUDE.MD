# Plant Monitor

Projeto de estudo para entrevista de Frontend na Tractian: um mini monitor industrial que consome dados de sensores IoT em tempo real.

## Stack

- Monorepo: pnpm workspaces + Turborepo
- apps/simulator: Node + ws. Só fonte de dados (GET /tree, GET /sensors/:id/history, WebSocket)
- apps/web: Next.js (App Router) + TypeScript
- packages/contracts: schemas zod e tipos compartilhados (`@plant-monitor/contracts`)
- packages/ui: componentes com CVA e tokens (Dia 4)

## Regras

- O foco do projeto é o frontend. Não altere o simulador nem os contratos sem eu pedir.
- Prefira a solução mais simples que atende ao pedido. Antes de adicionar algo além do que pedi (otimizações, padrões, bibliotecas, testes extras), pergunte.
- Antes de implementar, proponha um plano e espere minha aprovação.
- Explique decisões e trade-offs: o objetivo é aprender, não só ter o código.
- Ao terminar cada etapa, explique cada arquivo criado ou alterado em 2 a 3 linhas, em linguagem simples.
- TypeScript strict. Nada de `any`. Dados externos (API, WebSocket) validados com zod na fronteira.
- Tipos sempre importados de packages/contracts, nunca redefinidos no front.

## Onde fica cada estado (apps/web)

- Dados do servidor (árvore, histórico): React Query.
- Estado de tela compartilhado (seleção, expandidos, filtros): Zustand, sempre lido com seletores.
- Leituras em tempo real: store Zustand alimentada pelo WebSocket em lote (uma vez por frame).
- - Status de saúde por sensor e agregado na árvore: Zustand, com seletores que devolvem o pior status.
- Context só para o que muda pouco (providers, tema).

## Domínio

- Hierarquia: location → asset → sensor, em lista plana com parentId (~50 locations, ~1.000 assets, ~2.000 sensores).
- Sensores de vibração e temperatura, uma leitura por segundo.
- Status por limiar: ok, warning, critical. O status de um asset ou location é o pior status entre os sensores abaixo dele.
- WebSocket: `snapshot` ao conectar, `batch` a cada segundo, `alert` quando um sensor muda de status (`status: 'ok'` = resolvido).
