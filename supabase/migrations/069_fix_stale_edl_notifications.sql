-- Supprime les notifications ARRIVEE_IMMINENTE/DEPART_IMMINENT stales
-- pour les réservations dont l'EDL correspondant est déjà terminé.

-- EDL arrivée terminé → supprimer ARRIVEE_IMMINENTE
DELETE FROM notifications
WHERE type = 'ARRIVEE_IMMINENTE'
  AND entity_type = 'reservation'
  AND entity_id IN (
    SELECT r.id FROM reservations r
    JOIN dossiers d ON d.reservation_id = r.id
    JOIN edls e ON e.dossier_id = d.id
    WHERE e.type = 'ARRIVEE'
      AND e.statut IN ('TERMINE_OK', 'TERMINE_INCIDENT')
  );

-- EDL départ terminé → supprimer DEPART_IMMINENT
DELETE FROM notifications
WHERE type = 'DEPART_IMMINENT'
  AND entity_type = 'reservation'
  AND entity_id IN (
    SELECT r.id FROM reservations r
    JOIN dossiers d ON d.reservation_id = r.id
    JOIN edls e ON e.dossier_id = d.id
    WHERE e.type = 'DEPART'
      AND e.statut IN ('TERMINE_OK', 'TERMINE_INCIDENT')
  );

-- Idem pour entity_type = 'dossier' (anciennes notifs)
DELETE FROM notifications
WHERE type = 'ARRIVEE_IMMINENTE'
  AND entity_type = 'dossier'
  AND entity_id IN (
    SELECT d.id FROM dossiers d
    JOIN edls e ON e.dossier_id = d.id
    WHERE e.type = 'ARRIVEE'
      AND e.statut IN ('TERMINE_OK', 'TERMINE_INCIDENT')
  );

DELETE FROM notifications
WHERE type = 'DEPART_IMMINENT'
  AND entity_type = 'dossier'
  AND entity_id IN (
    SELECT d.id FROM dossiers d
    JOIN edls e ON e.dossier_id = d.id
    WHERE e.type = 'DEPART'
      AND e.statut IN ('TERMINE_OK', 'TERMINE_INCIDENT')
  );
