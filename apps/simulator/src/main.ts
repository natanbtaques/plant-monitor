import { startSimulator } from './server';

const SUMMARY_EVERY_MS = 10_000;

const summary = { warning: 0, critical: 0, resolved: 0, skippedBatches: 0, clients: 0 };

const sim = await startSimulator({
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  onTick: ({ alerts, clients, skippedBatches }) => {
    for (const alert of alerts) {
      if (alert.status === 'ok') summary.resolved++;
      else summary[alert.status]++;
    }
    summary.skippedBatches += skippedBatches;
    summary.clients = clients;
  },
});

console.log(`[sim] ${sim.nodeCount} nós, ${sim.sensorCount} sensores`);
console.log(`[sim] HTTP http://localhost:${sim.port} (GET /tree, /sensors/:id/history)`);
console.log(`[sim] WS   ws://localhost:${sim.port}/ws`);

setInterval(() => {
  const { warning, critical, resolved, skippedBatches, clients } = summary;
  console.log(
    `[sim] 10s: ${warning + critical + resolved} transições ` +
      `(${warning} warning, ${critical} critical, ${resolved} resolvidos), ` +
      `${clients} clientes, ${skippedBatches} batches pulados`,
  );
  Object.assign(summary, { warning: 0, critical: 0, resolved: 0, skippedBatches: 0 });
}, SUMMARY_EVERY_MS);

const shutdown = () => void sim.close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
