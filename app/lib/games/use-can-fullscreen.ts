'use client';

import { useSyncExternalStore } from 'react';

// Fullscreen support never changes during a session, so there is nothing to subscribe to.
const subscribe = () => () => {};
const getSnapshot = () => document.fullscreenEnabled === true;
// SSR and the hydration pass render without the button; the client snapshot swaps it in
// afterwards, so iOS Safari (no Fullscreen API) never shows it and hydration never mismatches.
const getServerSnapshot = () => false;

export const useCanFullscreen = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
