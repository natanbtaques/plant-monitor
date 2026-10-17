import { create } from 'zustand';

// Estado da conexão com o WebSocket. É estado de tela (não vem da rede), por isso o tipo
// é definido aqui e não em packages/contracts.
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
  attempt: number; // tentativas de reconexão seguidas sem sucesso
  retryInMs: number | null; // espera agendada até a próxima tentativa
}

// Sem ações: quem escreve é só o lib/realtime.ts, via useConnection.setState.
export const useConnection = create<ConnectionState>()(() => ({
  status: 'connecting',
  attempt: 0,
  retryInMs: null,
}));
