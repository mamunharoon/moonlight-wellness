/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/*
 * Back-navigation repair — NavigationHistoryContext
 *
 * Tracks which locations were actually visited within this running app
 * instance (keyed by react-router's own location.key), so a BackButton
 * can tell the difference between "there is a real WakeWise screen
 * behind this one" (safe to call navigate(-1), which lands on the
 * genuine previous in-app screen) and "this is the first screen this
 * app instance has rendered" (a direct URL open, a new tab, or a hard
 * reload — real browser history may contain nothing, an external page,
 * or nothing at all, so navigate(-1) is not safe; an explicit fallback
 * route is used instead).
 *
 * A location.key of 'default' is react-router's own value for the very
 * first entry of a fresh history instance — reloading always produces a
 * fresh stack here (stackRef is component state, reset on remount),
 * which is intentionally treated the same as "opened directly": safer
 * to land on a known fallback than to guess what a stale real history
 * entry behind it might be.
 *
 * On POP (browser back/forward, or iPhone's own edge-swipe gesture —
 * both fire as a popstate the router turns into a normal location
 * change), the revisited key already exists in the stack; the stack is
 * truncated back to that point rather than appended to, so repeated
 * back/forward doesn't grow the stack unbounded.
 *
 * Build 15 Phase B remediation (Task 4) fix — a REPLACE navigation (e.g.
 * a page's own "strip this one-time query param" mount effect, via
 * setSearchParams(next, { replace: true }) - AnytimeReset.jsx/
 * Meditate.jsx/Library.jsx all do this) still gets a brand-new
 * location.key, exactly like a genuine PUSH. Before this fix, that new
 * key was pushed as if it were a whole new page the user had navigated
 * to, inflating the tracked stack length past what was actually visited
 * - discovered live (Library's own new contextual Back control silently
 * did nothing) when a direct `/library?from=home` landing's own
 * param-strip effect was the very first thing to replace immediately on
 * mount, before any real second page was ever visited. `useNavigationType()`
 * (react-router's own per-render "what caused this location" value) lets
 * a REPLACE update the CURRENT top of the stack in place instead of
 * growing it - a PUSH still grows it, a POP still truncates it,
 * unchanged from before.
 */
const NavigationHistoryContext = createContext(null);

export const NavigationHistoryProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const stackRef = useRef([]);

  useEffect(() => {
    const stack = stackRef.current;
    const existingIndex = stack.indexOf(location.key);
    if (existingIndex !== -1) {
      stack.length = existingIndex + 1;
    } else if (navigationType === 'REPLACE' && stack.length > 0) {
      stack[stack.length - 1] = location.key;
    } else {
      stack.push(location.key);
    }
  }, [location.key, navigationType]);

  const goBack = (fallbackRoute) => {
    if (stackRef.current.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackRoute, { replace: true });
    }
  };

  return (
    <NavigationHistoryContext.Provider value={{ goBack }}>
      {children}
    </NavigationHistoryContext.Provider>
  );
};

export const useNavigationHistory = () => {
  const ctx = useContext(NavigationHistoryContext);
  if (!ctx) {
    throw new Error('useNavigationHistory must be used within a NavigationHistoryProvider');
  }
  return ctx;
};
