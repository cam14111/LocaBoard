// Utilitaires date natifs — pas de dépendance externe

const JOURS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Date → 'YYYY-MM-DD' */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → Date locale (pas UTC) */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Grille mois : 5-6 lignes × 7 colonnes (Lun-Dim), avec padding mois précédent/suivant */
export function getMonthGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  // Lundi = 0, Dimanche = 6 dans notre convention
  const startDow = (firstOfMonth.getDay() + 6) % 7;

  const gridStart = new Date(year, month, 1 - startDow);
  const weeks: Date[][] = [];

  const current = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    // Ne pas ajouter une 6e semaine si elle est entièrement dans le mois suivant
    if (w === 5 && week[0].getMonth() !== month) break;
    weeks.push(week);
  }

  return weeks;
}

/** 7 jours de la semaine contenant `date`, depuis le Lundi */
export function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Lundi de la semaine contenant `date` */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // Lundi=0
  d.setDate(d.getDate() - dow);
  return d;
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function addWeeks(date: Date, n: number): Date {
  return addDays(date, n * 7);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Vérifie si `date` est dans [start, end[ (inclusive début, exclusive fin) */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t < end.getTime();
}

/** Range de la grille entière du mois (pour l'API) */
export function getMonthRange(year: number, month: number): { from: string; to: string } {
  const grid = getMonthGrid(year, month);
  const first = grid[0][0];
  const last = grid[grid.length - 1][6];
  return { from: toDateString(first), to: toDateString(last) };
}

/** Range de la semaine contenant `date` */
export function getWeekRange(date: Date): { from: string; to: string } {
  const start = getWeekStart(date);
  const end = addDays(start, 6);
  return { from: toDateString(start), to: toDateString(end) };
}

/** "Février 2026" */
export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
}

/** "10 – 16 février 2026" */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();

  const startDay = weekStart.getDate();
  const endFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(weekEnd);

  if (sameMonth) {
    return `${startDay} – ${endFmt}`;
  }

  const startFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(weekStart);
  return `${startFmt} – ${endFmt}`;
}

/** Nom abrégé du jour (Lun, Mar, ...) */
export function getDayNameShort(dayIndex: number): string {
  return JOURS_FR[dayIndex].slice(0, 3).replace(/^./, (c) => c.toUpperCase());
}

/** 'YYYY-MM-DD' → '12 fév. 2026' */
export function formatDateFR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** Nombre de nuits entre deux dates 'YYYY-MM-DD' */
export function computeNights(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  const diff = d2.getTime() - d1.getTime();
  return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
}
