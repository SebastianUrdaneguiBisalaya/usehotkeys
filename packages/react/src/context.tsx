import {
  createHotkeys,
  type Hotkeys,
  type HotkeysOptions,
} from "@usehotkeys/core";
import { createContext, type ReactNode, useContext, useState } from "react";

const HotkeysContext = createContext<Hotkeys | null>(null);

let sharedInstance: Hotkeys | undefined;

/** The instance used by hooks when there is no `<HotkeysProvider>`. Created on first use. */
export function getSharedHotkeys(): Hotkeys {
  sharedInstance ??= createHotkeys();
  return sharedInstance;
}

/** Props for {@link HotkeysProvider}. */
export type HotkeysProviderProps = {
  children?: ReactNode;
  /** Use an instance you created yourself. Takes precedence over `options`. */
  hotkeys?: Hotkeys | undefined;
  /** Options for the instance the provider creates (`platform`, `defaults`, `onConflict`…). */
  options?: HotkeysOptions | undefined;
};

/**
 * Gives every hook below it its own isolated hotkeys instance, with its own scopes and conflicts.
 *
 * It is optional: without a provider the hooks share one global instance.
 *
 * @example
 * <HotkeysProvider options={{ debug: true }}>
 *   <App />
 * </HotkeysProvider>
 */
export function HotkeysProvider({
  children,
  hotkeys,
  options,
}: HotkeysProviderProps) {
  const [instance] = useState(() => hotkeys ?? createHotkeys(options));
  return (
    <HotkeysContext.Provider value={instance}>
      {children}
    </HotkeysContext.Provider>
  );
}

/** Returns the hotkeys instance in use: the nearest provider's, or the shared one. */
export function useHotkeysInstance(): Hotkeys {
  return useContext(HotkeysContext) ?? getSharedHotkeys();
}
