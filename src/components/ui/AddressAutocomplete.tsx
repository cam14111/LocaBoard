import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface AddressSuggestion {
  label: string;
  value: string;
}

interface AddressAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  pays?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const API_FRANCE = 'https://api-adresse.data.gouv.fr/search/';
const API_NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const COUNTRY_CODES: Record<string, string> = {
  France: 'fr',
  Belgique: 'be',
  Suisse: 'ch',
  Luxembourg: 'lu',
  'États-Unis': 'us',
  'Royaume-Uni': 'gb',
  Allemagne: 'de',
  Espagne: 'es',
  Italie: 'it',
  Canada: 'ca',
  'Pays-Bas': 'nl',
  Portugal: 'pt',
};

function debounce<T extends (...args: unknown[]) => void | Promise<void>>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export default function AddressAutocomplete({
  id,
  value,
  onChange,
  pays = 'France',
  placeholder = 'Rechercher une adresse…',
  required,
  className = '',
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `${id ?? 'addr'}-list`;
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isFrance = !pays || pays.toLowerCase() === 'france';

  async function fetchFrance(query: string): Promise<AddressSuggestion[]> {
    const url = `${API_FRANCE}?q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(url, { signal: abortRef.current?.signal });
    const json = await res.json();
    return (json.features ?? []).map((f: { properties: { label: string } }) => ({
      label: f.properties.label,
      value: f.properties.label,
    }));
  }

  async function fetchNominatim(query: string, countryCode: string): Promise<AddressSuggestion[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '1',
      countrycodes: countryCode,
    });
    const res = await fetch(`${API_NOMINATIM}?${params}`, {
      signal: abortRef.current?.signal,
      headers: { 'Accept-Language': 'fr' },
    });
    const json = await res.json();
    return (json as { display_name: string }[]).map((r) => ({
      label: r.display_name,
      value: r.display_name,
    }));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const search = useCallback(
    debounce(async (query: string) => {
      if (query.length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);

      try {
        let results: AddressSuggestion[];
        if (isFrance) {
          results = await fetchFrance(query);
        } else {
          const cc = COUNTRY_CODES[pays] ?? 'fr';
          results = await fetchNominatim(query, cc);
        }
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch {
        // Requête annulée ou erreur réseau — pas de message d'erreur
      } finally {
        setLoading(false);
      }
    }, 300) as (q: string) => void,
    [isFrance, pays],
  );

  function handleInput(v: string) {
    onChange(v);
    search(v);
  }

  function selectSuggestion(suggestion: AddressSuggestion) {
    onChange(suggestion.value);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Fermer au clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const INPUT =
    'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className={`${INPUT} pr-8 ${className}`}
          autoComplete="off"
        />
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-primary-50 ${
                i === activeIndex ? 'bg-primary-50 text-primary-700' : 'text-slate-700'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
