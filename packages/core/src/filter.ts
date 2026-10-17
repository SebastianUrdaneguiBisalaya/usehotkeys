const TEXT_INPUT_TYPES = new Set([
  "",
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

/** `true` for elements where the user types: text inputs, textareas, selects and `contenteditable`. */
export function isEditable(element: Element | null): boolean {
  if (element === null) {
    return false;
  }
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (tag === "INPUT") {
    return TEXT_INPUT_TYPES.has(
      ((element as HTMLInputElement).type ?? "").toLowerCase(),
    );
  }
  if ((element as HTMLElement).isContentEditable === true) {
    return true;
  }
  const attribute = element.getAttribute?.("contenteditable");
  return (
    attribute === "" || attribute === "true" || attribute === "plaintext-only"
  );
}

/** The element that really received the event, looking through open Shadow DOM boundaries. */
export function getEventTarget(event: Event): Element | null {
  const path = event.composedPath?.();
  const first = path?.[0] ?? event.target;
  return first !== null &&
    first !== undefined &&
    (first as Element).tagName !== undefined
    ? (first as Element)
    : null;
}
