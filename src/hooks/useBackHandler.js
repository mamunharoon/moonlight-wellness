import { useEffect, useRef } from 'react';
import { registerBackHandler } from '../lib/backHandlerRegistry';

/*
 * Android system Back button/gesture repair — registers `handler` as the
 * active back action for as long as `active` is true (default: for the
 * component's whole mounted lifetime). See backHandlerRegistry.js for
 * why a stack, and useAndroidBackButton.js for what actually invokes
 * this.
 *
 * `handler` is read through a ref rather than re-registered on every
 * render: callers routinely pass an inline closure that captures
 * per-render state (e.g. BackButton's handleClick, Support.jsx's
 * handleBack), and re-running the registration effect on every such
 * render would pointlessly pop and re-push this entry - harmless for
 * correctness (the true top-of-stack effect below only depends on
 * `active`) but wasteful. The ref always holds the latest closure, so
 * the handler actually invoked is never stale.
 *
 * `kind` - 'screen' (default, every caller but the four overlay
 * components) or 'overlay' (ConfirmDialog, SignInPromptDialog,
 * BetaVideoModal, BedtimeMediaChooser) - forwarded straight to
 * registerBackHandler; see backHandlerRegistry.js for why this is an
 * explicit priority tag rather than relying on registration order.
 */
export const useBackHandler = (handler, active = true, kind = 'screen') => {
  const handlerRef = useRef(handler);

  // Ref writes must happen outside render (react-hooks/refs) - this
  // effect (no dependency array, so it runs after every render) is the
  // standard safe way to keep a ref in sync with the latest render's
  // value without re-running the registration effect below on every
  // render.
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!active) return undefined;
    return registerBackHandler(() => handlerRef.current(), kind);
    // `kind` deliberately omitted from the dependency array below: it's
    // always a per-caller literal constant ('screen'/'overlay'), never a
    // variable that changes across a given caller's own re-renders, so
    // including it would be a no-op dependency, not a fix for anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
};
