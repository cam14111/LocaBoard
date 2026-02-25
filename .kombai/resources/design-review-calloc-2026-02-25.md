# Design Review Results: CalLoc — Application complète

**Review Date**: 2026-02-25  
**Routes reviewed**: `/` (Dashboard), `/calendrier`, `/dossiers`, `/taches`, `/parametres`  
**Focus Areas**: Visual Design, UX/Usability, Responsive/Mobile, Accessibility, Micro-interactions, Consistency, Performance  

---

## Summary

CalLoc is a well-structured rental management app (LMNP) with a clean information architecture and solid mobile-first foundation (sidebar + bottom nav pattern). The codebase is modular and the design system (Tailwind v4 + slate/primary-blue palette) is consistently applied. However, several **accessibility violations**, **mobile UX gaps on the Calendar**, **known display bugs** (floating scroll widget, incident pipeline badge), **inconsistent language** (French vs English "Dashboard"), and **performance bottlenecks** (3 s FCP, 512 ms INP) need to be addressed before production.

---

## Issues

| # | Issue | Criticality | Category | Location |
|---|-------|-------------|----------|----------|
| 1 | **Known bug**: A native browser scroll-arrows widget appears floating in the top-right area of the Documents tab content pane, obscuring the layout (`bug d'affichage.jpg`) | 🔴 Critical | Visual / Bug | `src/components/dossier/DocumentsTab.tsx` — likely overflow/z-index on the version-history modal or a rogue `<select>` |
| 2 | **Accessibility — Critical**: `<select>` in LogementSelector has no associated `<label>`, `aria-label`, or `title` — fails WCAG 2.1 A §4.1.2 | 🔴 Critical | Accessibility | `src/components/layout/LogementSelector.tsx` |
| 3 | **Known bug**: Pipeline "EDL sortie incident" label appears as a duplicate floating element below/outside the stepper, separate from step 11 (`bug pipeline.jpg`) — caused by `isIncidentVariant` logic displaying both inline and as a separate badge | 🔴 Critical | Visual / Bug | `src/components/dossier/PipelineStepper.tsx:113-120` |
| 4 | **Accessibility — High**: Notification badge contrast is 3.8:1 (white text on `#fb2c36` at 10px bold), needs ≥ 4.5:1 (WCAG AA) | 🟠 High | Accessibility | `src/components/layout/Header.tsx:83-85` |
| 5 | **Mobile UX — High**: Calendar month name truncates to "F..." on mobile viewports due to `flex-1 min-w-0 truncate` with competing flex children | 🟠 High | Responsive | `src/components/calendar/CalendarHeader.tsx:73` |
| 6 | **Mobile UX — High**: Calendar month view shows only tiny colored dots on mobile — event names are hidden entirely, making the calendar nearly unreadable on phones | 🟠 High | UX + Responsive | `src/components/calendar/DayCell.tsx:44-50`, `src/components/calendar/MonthGrid.tsx` |
| 7 | **Performance — High**: First Contentful Paint is 2 992 ms (threshold: < 1.8 s) and INP is 512 ms (threshold: < 200 ms) — both in the "Poor" range | 🟠 High | Performance | Initial bundle — `src/App.tsx` (Suspense/lazy) + Supabase SDK weight |
| 8 | **Accessibility — Medium**: `DayCell` `<button>` has no `aria-label` — screen readers announce only the day number ("25") with no month/year context | 🟡 Medium | Accessibility | `src/components/calendar/DayCell.tsx:27-33` |
| 9 | **Accessibility — Medium**: No `<h1>` element on any page — pages use `<h2>` for titles, violating WCAG best practice for heading structure | 🟡 Medium | Accessibility | All page components (Dashboard, Calendar, Dossiers, etc.) |
| 10 | **Consistency — Medium**: Page title "Dashboard" is in English while all other labels, nav items, and UI copy are in French — breaks language consistency | 🟡 Medium | Consistency | `src/pages/Dashboard.tsx` (heading text) |
| 11 | **UX — Medium**: Mobile dashboard stat cards stack in a single column — makes it harder to compare Arrivées vs Départs side-by-side; a 2×2 grid would be more efficient | 🟡 Medium | UX + Responsive | `src/pages/Dashboard.tsx` (stat card grid) |
| 12 | **Consistency — Medium**: Supabase notifications endpoint returns 403 on every page load, causing console noise and potentially incorrect unread counts throughout the session | 🟡 Medium | Consistency / Performance | `src/hooks/useUnreadNotifications.ts`, `src/hooks/useNotificationSweep.ts` |
| 13 | **Visual — Medium**: Paramètres page contains only 4 plain list items with excessive whitespace and no visual grouping — low information density, feels unfinished | 🟡 Medium | Visual Design | `src/pages/settings/SettingsIndex.tsx` |
| 14 | **Visual — Medium**: Document version badge is hardcoded as "v2" regardless of actual version count — if a document is replaced more than once, the badge will always show v2 | 🟡 Medium | Visual Design | `src/components/dossier/DocumentsTab.tsx:254-258` |
| 15 | **Accessibility — Low**: Calendar filter checkboxes on desktop use `className="sr-only"` visually hiding the native checkbox, with no custom focus indicator replacing it — keyboard users lose focus feedback | ⚪ Low | Accessibility | `src/components/calendar/CalendarHeader.tsx:99-101` |
| 16 | **Performance — Low**: Supabase notifications fetch fires on every page navigation (even when unauthorized), adding an unnecessary 403 network round-trip per route change | ⚪ Low | Performance | `src/hooks/useNotificationSweep.ts` |
| 17 | **Micro-interactions — Low**: No route transition animations between pages — content jumps instantly with no visual continuity | ⚪ Low | Micro-interactions | `src/App.tsx` (Suspense boundaries) |
| 18 | **Micro-interactions — Low**: Task completion, pipeline transitions, and document uploads provide no success confirmation (toast/snack) — users must infer success from the updated list | ⚪ Low | Micro-interactions | `src/components/dossier/PipelineStepper.tsx`, `src/pages/Tasks.tsx` |
| 19 | **Visual — Low**: Action buttons (Voir, Télécharger, Remplacer) have very subtle hover state (`hover:bg-slate-50`) that is nearly invisible — low affordance feedback | ⚪ Low | Visual Design | `src/components/dossier/DocumentsTab.tsx:265-300` |
| 20 | **Mobile — Low**: Bottom nav labels are 10–12px — borderline legible on small screens and at system accessibility font-size overrides | ⚪ Low | Responsive | `src/components/layout/BottomNav.tsx:28` |

---

## Criticality Legend

- 🔴 **Critical**: Breaks functionality, violates accessibility standards, or is a visible display bug
- 🟠 **High**: Significantly impacts user experience, performance SLAs, or design quality
- 🟡 **Medium**: Noticeable issue that should be addressed before v1.0
- ⚪ **Low**: Nice-to-have improvement or minor polish item

---

## Top Bug Locations (from bug images)

```
bug d'affichage.jpg → DocumentsTab overlay/z-index issue
  → Floating native browser scroll widget in top-right of content pane
  → Check: hidden <input type="file"> or version modal z-index / overflow

bug pipeline.jpg → PipelineStepper incident logic
  → "EDL sortie incident" renders as both a step variant AND a separate floating badge
  → Check: isIncidentVariant branching in PipelineStepper.tsx:113-120
```

---

## Next Steps (Prioritized)

### 🔴 Fix Now (Sprint 1)
1. Fix floating scroll widget bug in DocumentsTab (investigate z-index / `replaceInputRef` overflow)
2. Fix PipelineStepper incident badge duplication
3. Add `aria-label` to LogementSelector `<select>`
4. Fix notification badge contrast (use `bg-red-600` `#dc2626` instead of `bg-red-500` for better contrast at small sizes)

### 🟠 Fix Soon (Sprint 2)
5. Fix calendar mobile title truncation — reduce title font size on mobile or prioritize title flex space
6. Improve mobile calendar — show short event titles or at least a count tooltip on tap
7. Investigate and improve INP (512 ms) — profile event handlers on calendar day clicks
8. Add `aria-label` to DayCell buttons with full date string

### 🟡 Improvements (Sprint 3)
9. Rename "Dashboard" heading to French equivalent (e.g., "Tableau de bord")
10. Switch mobile stat cards to a 2×2 grid (`grid-cols-2`)
11. Fix hardcoded document "v2" badge — compute from actual version list
12. Investigate and resolve Supabase 403 on notifications (RLS policy gap)
13. Add `<h1>` to all page components (or convert `<h2>` to `<h1>`)

### ⚪ Polish (Backlog)
14. Add route transition animations (React transitions or Framer Motion)
15. Add success toasts after pipeline transitions and document uploads
16. Improve Settings page layout with card groupings and section headers
17. Upgrade action button hover states to `hover:bg-slate-100 hover:shadow-sm`
18. Fix hidden checkbox focus indicators in calendar filter bar
