type KeyInit = KeyboardEventInit & {
  target?: Element | Document;
};

/** Dispatches a keydown on `target` (default: `document`) and returns the event. */
export function press(
  init: KeyInit,
  type: "keydown" | "keyup" = "keydown",
): KeyboardEvent {
  const { target = document, ...eventInit } = init;
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...eventInit,
  });
  target.dispatchEvent(event);
  return event;
}

/** Shorthand for a letter key press: `key("k", { ctrlKey: true })`. */
export function key(
  letter: string,
  init: KeyInit = {},
  type: "keydown" | "keyup" = "keydown",
): KeyboardEvent {
  const upper = letter.toUpperCase();
  return press(
    {
      code: /^[a-z]$/i.test(letter) ? `Key${upper}` : "",
      key: letter,
      ...init,
    },
    type,
  );
}
