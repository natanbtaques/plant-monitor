# Plant Monitor

Projeto de estudo para entrevista de Frontend na Tractian: um mini monitor industrial com simulador de sensores IoT.

## Stack

- Monorepo: pnpm workspaces + Turborepo
- apps/simulator: Node + ws (WebSocket) + endpoint REST de histórico
- apps/web: Next.js (App Router) + TypeScript (Dia 2 em diante)
- packages/contracts: schemas zod e tipos compartilhados entre simulador e front
- packages/ui: componentes com CVA e tokens (Dia 4)

## Regras

- TypeScript strict. Nada de `any`. Dados externos (WebSocket, API) validados com zod na fronteira.
- Tipos derivados dos schemas (`z.infer`), uma única fonte de verdade em packages/contracts.
- Árvore de ativos em formato normalizado (lista plana com parentId), não aninhada.
- Antes de implementar, proponha um plano e espere minha aprovação.
- Explique decisões e trade-offs: o objetivo é aprender, não só ter o código.

## Domínio

Hierarquia: location → asset → sensor (como no desafio da Tractian), ~2 mil sensores.
Sensores de vibração e temperatura, 1 Hz, com ruído e degradação gradual até alerta crítico.

- Prefira a solução mais simples que atende ao pedido. Antes de adicionar
  algo além do que pedi (otimizações, padrões, testes extras), pergunte.
- O foco do projeto é o frontend. O simulador é só fonte de dados.
