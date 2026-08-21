/** Eventos técnicos permitidos en consola; excluyen cargas, cookies y tokens. */
export type TelemetryEvent = {
  event: 'api_failure' | 'api_unauthorized' | 'ui_error';
  operation: string;
  status?: number;
  requestId?: string;
};

/** Registra telemetría estructurada y mínima sin datos proporcionados por usuarios. */
export function recordTelemetry(event: TelemetryEvent): void {
  console.error(JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
}
