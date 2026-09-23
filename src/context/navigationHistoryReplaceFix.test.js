// Build 15 Phase B remediation (Task 4) — NavigationHistoryContext.jsx
// regression guard. Discovered live: a page's own "strip this one-time
// query param" mount effect (setSearchParams(next, { replace: true }) -
// AnytimeReset.jsx/Meditate.jsx/Library.jsx all do this) got a brand-new
// location.key exactly like a genuine PUSH, so the old tracking effect
// pushed it as a whole extra "page visited" - inflating the stack past
// what was actually visited, which made goBack() wrongly believe
// navigate(-1) was safe when it wasn't (Library's own new "Back to Home"
// control silently did nothing on a direct `/library?from=home` landing,
// whose own param-strip effect fires immediately on mount). Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./NavigationHistoryContext.jsx', import.meta.url)), 'utf-8');

describe('NavigationHistoryContext.jsx — a REPLACE navigation updates the stack top in place, never grows it', () => {
  it('imports and reads useNavigationType()', () => {
    expect(source).toMatch(/import \{ useLocation, useNavigate, useNavigationType \} from 'react-router-dom';/);
    expect(source).toMatch(/const navigationType = useNavigationType\(\);/);
  });

  it('a REPLACE with an existing stack replaces the top entry instead of pushing a new one', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const stack = stackRef\.current;[\s\S]*?\n {2}\}, \[location\.key, navigationType\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/\} else if \(navigationType === 'REPLACE' && stack\.length > 0\) \{\s*\n\s*stack\[stack\.length - 1\] = location\.key;/);
  });

  it('a genuine PUSH (or the very first location, an empty stack) still grows the stack, unchanged from before', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const stack = stackRef\.current;[\s\S]*?\n {2}\}, \[location\.key, navigationType\]\);/)?.[0] ?? '';
    expect(body).toMatch(/\} else \{\s*\n\s*stack\.push\(location\.key\);\s*\n\s*\}/);
  });

  it('a POP (revisiting an already-tracked key) still truncates the stack back to that point, unchanged from before', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const stack = stackRef\.current;[\s\S]*?\n {2}\}, \[location\.key, navigationType\]\);/)?.[0] ?? '';
    expect(body).toMatch(/if \(existingIndex !== -1\) \{\s*\n\s*stack\.length = existingIndex \+ 1;/);
  });

  it('goBack itself is unchanged - navigate(-1) when the (now-correctly-counted) stack has real depth, otherwise the explicit fallback route', () => {
    expect(source).toMatch(/const goBack = \(fallbackRoute\) => \{\s*\n\s*if \(stackRef\.current\.length > 1\) \{\s*\n\s*navigate\(-1\);\s*\n\s*\} else \{\s*\n\s*navigate\(fallbackRoute, \{ replace: true \}\);\s*\n\s*\}\s*\n\s*\};/);
  });
});
