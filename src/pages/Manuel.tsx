import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ChevronDown, BookOpen } from 'lucide-react';
import { manualSections, type ManualSection } from '@/data/helpContent';

// ─── Helpers ──────────────────────────────────────────────────

/** Aplatit l'arbre de sections en liste (parents + enfants) */
function flattenSections(sections: ManualSection[]): ManualSection[] {
  const flat: ManualSection[] = [];
  for (const s of sections) {
    flat.push(s);
    if (s.children) {
      for (const c of s.children) {
        flat.push(c);
      }
    }
  }
  return flat;
}

const allSections = flattenSections(manualSections);

/** Nettoie le HTML pour la recherche texte */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// ─── Composant TOC ────────────────────────────────────────────

function TocItem({
  section,
  activeId,
  depth,
  onClick,
}: {
  section: ManualSection;
  activeId: string;
  depth: number;
  onClick: (id: string) => void;
}) {
  const isActive = activeId === section.id;
  return (
    <>
      <button
        type="button"
        onClick={() => onClick(section.id)}
        className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
          depth > 0 ? 'pl-6' : ''
        } ${
          isActive
            ? 'bg-primary-50 text-primary-700 font-medium'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {section.title}
      </button>
      {section.children?.map((child) => (
        <TocItem key={child.id} section={child} activeId={activeId} depth={depth + 1} onClick={onClick} />
      ))}
    </>
  );
}

// ─── Page Manuel ──────────────────────────────────────────────

export default function Manuel() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(manualSections[0]?.id ?? '');
  const [tocOpen, setTocOpen] = useState(false);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Scroll vers l'ancre au montage
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        setActiveId(id);
      }
    }
  }, [location.hash]);

  // IntersectionObserver pour mettre en surbrillance la section visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [search]); // re-observe quand le filtre change

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      setTocOpen(false);
    }
  }, []);

  // Filtrage par recherche
  const query = search.toLowerCase().trim();
  const filteredSections = query
    ? allSections.filter(
        (s) => s.title.toLowerCase().includes(query) || stripHtml(s.content).includes(query),
      )
    : allSections;

  const filteredTopLevel = query
    ? filteredSections
    : manualSections; // pour le TOC, on garde la hiérarchie

  return (
    <div className="lg:flex lg:gap-8">
      {/* ── Sidebar TOC (desktop) ── */}
      <nav className="hidden lg:block lg:w-56 lg:shrink-0">
        <div className="sticky top-20 space-y-1">
          <div className="flex items-center gap-2 px-3 mb-3">
            <BookOpen className="h-4 w-4 text-primary-600" />
            <span className="text-sm font-semibold text-slate-900">Manuel</span>
          </div>
          {filteredTopLevel.map((s) => (
            <TocItem key={s.id} section={s} activeId={activeId} depth={0} onClick={scrollTo} />
          ))}
        </div>
      </nav>

      {/* ── Contenu principal ── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Barre de recherche + TOC mobile */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans le manuel…"
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* TOC mobile (dropdown) */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setTocOpen(!tocOpen)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary-600" />
                Sommaire
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${tocOpen ? 'rotate-180' : ''}`} />
            </button>
            {tocOpen && (
              <div className="mt-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg space-y-0.5">
                {filteredTopLevel.map((s) => (
                  <TocItem key={s.id} section={s} activeId={activeId} depth={0} onClick={scrollTo} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sections */}
        {query ? (
          // Mode recherche : afficher uniquement les sections qui matchent (flat)
          filteredSections.length > 0 ? (
            filteredSections.map((s) => (
              <SectionBlock key={s.id} section={s} registerRef={registerRef} />
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">Aucun résultat pour « {search} »</p>
            </div>
          )
        ) : (
          // Mode normal : hiérarchie complète
          manualSections.map((s) => (
            <div key={s.id} className="space-y-4">
              <SectionBlock section={s} registerRef={registerRef} />
              {s.children?.map((child) => (
                <SectionBlock key={child.id} section={child} registerRef={registerRef} isChild />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Bloc de section ──────────────────────────────────────────

function SectionBlock({
  section,
  registerRef,
  isChild = false,
}: {
  section: ManualSection;
  registerRef: (id: string, el: HTMLElement | null) => void;
  isChild?: boolean;
}) {
  return (
    <section
      id={section.id}
      ref={(el) => registerRef(section.id, el)}
      className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${isChild ? 'border-l-primary-200 bg-slate-50/50' : ''}`}
    >
      {isChild ? (
        <h3 className="text-base font-medium text-slate-800 mb-3">{section.title}</h3>
      ) : (
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{section.title}</h2>
      )}
      <div
        className="prose prose-sm prose-slate max-w-none [&_dt]:font-semibold [&_dt]:mt-3 [&_dd]:ml-4 [&_dd]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    </section>
  );
}
