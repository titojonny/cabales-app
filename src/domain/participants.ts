import type { EventParticipant } from '../api/contracts';

/** Resuelve un nombre real y usa un fallback honesto cuando la API no lo incluye. */
export function participantLabel(participant: EventParticipant): string {
  return (
    participant.groupMember?.user?.displayName ||
    participant.guestName ||
    `Participante ${participant.id.slice(0, 8)}`
  );
}

/** Indexa el padrón de evento para enriquecer gastos y transferencias tras una recarga. */
export function participantLabelMap(participants?: EventParticipant[]): Map<string, string> {
  return new Map(
    (participants ?? []).map((participant) => [participant.id, participantLabel(participant)]),
  );
}

/** Conserva el nombre invitado del detalle financiero o muestra un identificador corto. */
export function fallbackParticipantLabel(id: string, guestName?: string): string {
  return guestName || `Participante ${id.slice(0, 8)}`;
}
