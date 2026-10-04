export type Speaker = 'nami' | 'clinic' | 'contact' | 'recipient' | 'system';
export type Turn = { speaker: Speaker; text: string; t: number };

export type ClinicBrief = {
  goal: 'availability' | 'confirm';
  clinicName: string;
  clinicNameHi: string;
  doctor: string;
  patientFirstName: string;
  patientLastInitial: string | null;
  reason: string;
  dateFrom: string;
  dateTo: string;
  dateFromSpoken: string;
  dateToSpoken: string;
  window: 'morning' | 'afternoon' | 'evening' | 'any';
  permittedFields: string[];
  approvedSlot: { dateIso: string; time24h: string; spokenEn: string; spokenHi: string } | null;
  scenario: string;
  forbiddenDetails: string[];
};

export type ContactBrief = { contactName: string; recipientName: string; caseKind: 'checkin' | 'help'; factsEn: string; factsHi: string };

export function transcriptText(turns: Turn[]) {
  return turns.map((x) => `${x.speaker.toUpperCase()}: ${x.text}`).join('\n');
}
