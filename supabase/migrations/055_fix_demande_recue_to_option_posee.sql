-- Correction des dossiers dont le pipeline_statut est resté à 'DEMANDE_RECUE' (statut legacy)
-- Ces dossiers ont été créés via une réservation directe (sans option), le statut initial
-- aurait dû être 'OPTION_POSEE' (première étape du pipeline).
UPDATE dossiers
SET pipeline_statut = 'OPTION_POSEE'
WHERE pipeline_statut = 'DEMANDE_RECUE';
