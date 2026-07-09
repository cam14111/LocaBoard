-- 078 : jeton iCal par logement pour l'export du calendrier
-- (flux : Airbnb / Booking / Google Agenda s'abonnent à l'URL de l'edge
-- function ical-export?token=<ical_token> qui sert un fichier .ics à jour)
alter table public.logements
  add column if not exists ical_token uuid not null default gen_random_uuid();

create unique index if not exists idx_logements_ical_token
  on public.logements (ical_token);
