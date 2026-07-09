// Edge Function : ical-export
// Sert le calendrier d'un logement au format iCalendar (RFC 5545).
// Accessible sans authentification : le jeton (logements.ical_token) fait
// office de secret. Utilisé pour synchroniser LocaBoard vers Airbnb,
// Booking.com, Google Agenda, etc. (abonnement à l'URL).
//
// Déploiement :
//   supabase functions deploy ical-export --project-ref <project-ref> --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** Échappe une valeur texte iCalendar (RFC 5545 §3.3.11). */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** 2026-07-09 → 20260709 (dates all-day). */
function icsDate(isoDate: string): string {
  return isoDate.replaceAll('-', '');
}

function icsEvent(params: {
  uid: string;
  start: string;
  end: string; // exclusif (jour du départ)
  summary: string;
  description?: string;
}): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${params.uid}@locaboard`,
    `DTSTART;VALUE=DATE:${icsDate(params.start)}`,
    `DTEND;VALUE=DATE:${icsDate(params.end)}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
  ];
  if (params.description) lines.push(`DESCRIPTION:${escapeIcsText(params.description)}`);
  lines.push('END:VEVENT');
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const token = new URL(req.url).searchParams.get('token');
  // Le jeton est un UUID : rejeter tôt tout autre format
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new Response('Lien invalide.', { status: 400, headers: CORS_HEADERS });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: logement } = await supabaseAdmin
    .from('logements')
    .select('id, nom')
    .eq('ical_token', token)
    .is('archived_at', null)
    .maybeSingle();

  if (!logement) {
    return new Response('Lien introuvable.', { status: 404, headers: CORS_HEADERS });
  }

  const [{ data: reservations }, { data: blocages }] = await Promise.all([
    supabaseAdmin
      .from('reservations')
      .select('id, date_debut, date_fin, statut, locataire_nom, locataire_prenom')
      .eq('logement_id', logement.id)
      .in('statut', ['CONFIRMEE', 'OPTION_ACTIVE'])
      .is('archived_at', null),
    supabaseAdmin
      .from('blocages')
      .select('id, date_debut, date_fin, motif')
      .eq('logement_id', logement.id)
      .is('archived_at', null),
  ]);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LocaBoard//Calendrier logement//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`LocaBoard — ${logement.nom}`)}`,
  ];

  for (const r of reservations ?? []) {
    const isOption = r.statut === 'OPTION_ACTIVE';
    lines.push(
      ...icsEvent({
        uid: `resa-${r.id}`,
        start: r.date_debut,
        end: r.date_fin,
        summary: isOption
          ? `Option — ${r.locataire_prenom} ${r.locataire_nom}`
          : `Réservé — ${r.locataire_prenom} ${r.locataire_nom}`,
      }),
    );
  }

  for (const b of blocages ?? []) {
    lines.push(
      ...icsEvent({
        uid: `blocage-${b.id}`,
        start: b.date_debut,
        end: b.date_fin,
        summary: 'Indisponible',
        description: `Blocage (${b.motif})`,
      }),
    );
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n') + '\r\n', {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="locaboard.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
