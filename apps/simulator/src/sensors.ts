import type {
  Alert,
  HealthStatus,
  HistoryPoint,
  HistoryQuery,
  Reading,
  SensorNode,
  SensorType,
  Thresholds,
} from '@plant-monitor/contracts';

const PROFILES: Record<SensorType, { baseline: [number, number]; noise: number; floor: number }> = {
  vibration: { baseline: [1.2, 2.8], noise: 0.15, floor: 0 },
  temperature: { baseline: [38, 52], noise: 0.4, floor: -40 },
};

const DEGRADING_FRACTION = 0.03; // ~3% dos sensores degradando a qualquer momento
const RAMP_SECONDS: [number, number] = [180, 480]; // tempo do baseline até o crítico
const MAINTENANCE_AFTER_MS = 60_000; // tempo em crítico até a "manutenção" consertar
const HYSTERESIS = 0.1; // para descer de estado, o valor precisa ficar 10% abaixo do limiar
const HISTORY_WINDOW_MS = 3_600_000;
const HISTORY_STEP_MS = 1000;

interface Sensor {
  node: SensorNode;
  baseline: number;
  /** Rampa linear: valor = baseline + ratePerSec × segundos desde `since`. */
  degradation: { since: number; ratePerSec: number } | null;
  status: HealthStatus;
  criticalSince: number | null;
  /** Última transição; enquanto `status !== 'ok'` é o alerta ativo. */
  lastAlert: Alert | null;
  last: Reading;
}

const RANK: Record<HealthStatus, number> = { ok: 0, warning: 1, critical: 2 };

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normal padrão via Box–Muller. */
const gaussian = () =>
  Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

function levelOf(value: number, t: Thresholds, margin: number): HealthStatus {
  if (value >= t.critical * margin) return 'critical';
  if (value >= t.warning * margin) return 'warning';
  return 'ok';
}

/** Sobe ao cruzar o limiar; só desce quando o valor fica `HYSTERESIS` abaixo dele. */
export function nextStatus(current: HealthStatus, value: number, t: Thresholds): HealthStatus {
  const entering = levelOf(value, t, 1);
  if (RANK[entering] >= RANK[current]) return entering;
  const exiting = levelOf(value, t, 1 - HYSTERESIS);
  return RANK[exiting] < RANK[current] ? exiting : current;
}

export class Simulation {
  private readonly sensors: Sensor[];
  private readonly byId: Map<string, Sensor>;
  private alertSeq = 0;
  private lastTs: number;

  constructor(nodes: SensorNode[], now: number) {
    this.sensors = nodes.map((node) => ({
      node,
      baseline: between(PROFILES[node.sensorType].baseline),
      degradation: null,
      status: 'ok',
      criticalSince: null,
      lastAlert: null,
      last: { sensorId: node.id, ts: now, value: 0 },
    }));
    this.byId = new Map(this.sensors.map((s) => [s.node.id, s]));
    this.lastTs = now;
    // Na largada, espalha o progresso das degradações para elas não andarem sincronizadas.
    this.startDegradations(now, true);
    this.tick(now);
  }

  tick(ts: number): { readings: Reading[]; alerts: Alert[] } {
    this.startDegradations(ts, false);
    const alerts: Alert[] = [];

    for (const s of this.sensors) {
      if (s.criticalSince !== null && ts - s.criticalSince >= MAINTENANCE_AFTER_MS) {
        s.degradation = null;
        s.criticalSince = null;
      }

      const value = this.valueAt(s, ts);
      s.last = { sensorId: s.node.id, ts, value };

      const status = nextStatus(s.status, value, s.node.thresholds);
      if (status === s.status) continue;

      const worst = RANK[status] > RANK[s.status] ? status : s.status;
      const alert: Alert = {
        id: `alert-${++this.alertSeq}`,
        sensorId: s.node.id,
        status,
        previousStatus: s.status,
        value,
        threshold: worst === 'critical' ? s.node.thresholds.critical : s.node.thresholds.warning,
        ts,
      };
      s.status = status;
      s.lastAlert = alert;
      s.criticalSince = status === 'critical' ? ts : null;
      alerts.push(alert);
    }

    this.lastTs = ts;
    return { readings: this.sensors.map((s) => s.last), alerts };
  }

  snapshot(): { ts: number; readings: Reading[]; activeAlerts: Alert[] } {
    return {
      ts: this.lastTs,
      readings: this.sensors.map((s) => s.last),
      activeAlerts: this.sensors.flatMap((s) =>
        s.status !== 'ok' && s.lastAlert ? [s.lastAlert] : [],
      ),
    };
  }

  /**
   * Histórico gerado na hora (nada é guardado): a mesma fórmula do tick aplicada a timestamps
   * passados, com até `limit` pontos espaçados na última hora. O último ponto é o valor atual.
   * `null` quando o sensor não existe.
   */
  history(sensorId: string, { from, to, limit }: HistoryQuery): HistoryPoint[] | null {
    const s = this.byId.get(sensorId);
    if (!s) return null;

    const end = Math.min(to ?? this.lastTs, this.lastTs);
    const start = Math.max(from ?? 0, this.lastTs - HISTORY_WINDOW_MS + HISTORY_STEP_MS);
    if (start > end) return [];

    const available = Math.floor((end - start) / HISTORY_STEP_MS) + 1;
    const count = Math.min(available, limit ?? available);
    const stepsBetween = count > 1 ? (available - 1) / (count - 1) : 0;

    const points: HistoryPoint[] = [];
    for (let i = 0; i < count; i++) {
      const ts = end - Math.round((count - 1 - i) * stepsBetween) * HISTORY_STEP_MS;
      points.push({ ts, value: ts === s.last.ts ? s.last.value : this.valueAt(s, ts) });
    }
    return points;
  }

  private valueAt(s: Sensor, ts: number): number {
    const profile = PROFILES[s.node.sensorType];
    const drift = s.degradation
      ? s.degradation.ratePerSec * Math.max(0, (ts - s.degradation.since) / 1000)
      : 0;
    return round2(Math.max(profile.floor, s.baseline + drift + gaussian() * profile.noise));
  }

  /** Mantém ~3% degradando: quando um é consertado, outro começa a falhar. */
  private startDegradations(now: number, staggered: boolean): void {
    const target = Math.round(this.sensors.length * DEGRADING_FRACTION);
    let active = this.sensors.filter((s) => s.degradation).length;

    for (let tries = 0; active < target && tries < this.sensors.length; tries++) {
      const s = this.sensors[Math.floor(Math.random() * this.sensors.length)];
      if (!s || s.degradation || s.status !== 'ok') continue;
      const rampSeconds = between(RAMP_SECONDS);
      const headStartMs = staggered ? Math.random() * rampSeconds * 1000 : 0;
      s.degradation = {
        since: now - headStartMs,
        ratePerSec: (s.node.thresholds.critical - s.baseline) / rampSeconds,
      };
      active++;
    }
  }
}
