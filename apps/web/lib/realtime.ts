import { WsMessage, type Reading } from '@plant-monitor/contracts';
import { useConnection } from '../stores/connection';
import { useReadings } from '../stores/readings';
import { useSensorStatus } from '../stores/sensor-status';
import { getApiUrl } from './config';

const MAX_DELAY_MS = 30_000;
const BASE_DELAY_MS = 1_000;

/**
 * Conexão em tempo real, fora do React: abre o WebSocket, valida as mensagens, aplica as
 * leituras nas stores uma vez por frame e reconecta sozinha. Retorna a função que encerra tudo.
 */
export function startRealtime(): () => void {
  const url = `${getApiUrl().replace(/^http/, 'ws')}/ws`;
  let ws: WebSocket | null = null;
  let attempt = 0;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let frame: number | null = null;
  // Map e não array: guarda só a leitura mais recente de cada sensor. Em aba oculta o
  // navegador pausa o requestAnimationFrame; assim o buffer nunca passa de ~2.000 entradas.
  let buffer = new Map<string, Reading>();

  // Uma vez por frame: esvazia o buffer na store (1 set → 1 rodada de seletores).
  function flush() {
    frame = null;
    const readings = buffer.values();
    buffer = new Map();
    useReadings.getState().applyBatch(readings);
  }

  function handle(message: WsMessage) {
    switch (message.type) {
      case 'snapshot':
        buffer.clear();
        useReadings.getState().replaceAll(message.readings);
        useSensorStatus.getState().replaceAll(message.activeAlerts);
        break;
      case 'batch':
        for (const r of message.readings) {
          const prev = buffer.get(r.sensorId);
          if (!prev || r.ts > prev.ts) buffer.set(r.sensorId, r);
        }
        frame ??= requestAnimationFrame(flush);
        break;
      // Alertas são poucos (não 2.000/s como as leituras): aplicados na hora, sem buffer.
      case 'alert':
        useSensorStatus.getState().setStatus(message.alert.sensorId, message.alert.status);
        break;
    }
  }

  function connect() {
    useConnection.setState({ status: attempt === 0 ? 'connecting' : 'reconnecting' });
    const socket = new WebSocket(url);
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      useConnection.setState({ status: 'open', attempt: 0, retryInMs: null });
    };

    // Fronteira: só entra no app o que passar pelo schema do contrato.
    socket.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return console.warn('[realtime] mensagem não é JSON');
      }
      const parsed = WsMessage.safeParse(data);
      if (!parsed.success) return console.warn('[realtime] mensagem inválida', parsed.error.issues);
      handle(parsed.data);
    };

    // Caiu (ou não conseguiu abrir): agenda nova tentativa com backoff exponencial + jitter.
    socket.onclose = () => {
      if (stopped) return;
      const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
      // "Equal jitter": metade fixa + metade aleatória. Espalha as reconexões de muitos
      // clientes e ainda deixa a espera visivelmente crescente (1 s, 2 s, 4 s… até 30 s).
      const delay = Math.round(exp / 2 + Math.random() * (exp / 2));
      attempt++;
      useConnection.setState({ status: 'reconnecting', attempt, retryInMs: delay });
      retryTimer = setTimeout(connect, delay);
    };
  }

  connect();

  return () => {
    stopped = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    if (frame !== null) cancelAnimationFrame(frame);
    buffer.clear();
    ws?.close();
  };
}
