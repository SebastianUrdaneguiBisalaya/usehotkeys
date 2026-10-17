import { act, cleanup, render } from "@testing-library/react";
import { createHotkeys } from "@usehotkeys/core";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HotkeysProvider, useHotkeyScope, useHotkeys } from "../src/index.js";

afterEach(cleanup);

const press = (
  key: string,
  init: KeyboardEventInit = {},
  target: Element | Document = document,
) =>
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: `Key${key.toUpperCase()}`,
        key,
        ...init,
      }),
    );
  });

describe("useHotkeys", () => {
  it("fires while mounted and stops after unmount", () => {
    const handler = vi.fn();
    const Component = () => {
      useHotkeys("k", handler);
      return null;
    };
    const { unmount } = render(<Component />);
    press("k");
    unmount();
    press("k");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("always calls the latest handler without re-registering", () => {
    const seen: number[] = [];
    const Counter = () => {
      const [count, setCount] = useState(0);
      useHotkeys("k", () => seen.push(count));
      useHotkeys("j", () => setCount((value) => value + 1));
      return null;
    };
    render(<Counter />);
    press("k");
    press("j");
    press("k");
    expect(seen).toEqual([
      0,
      1,
    ]);
  });

  it("respects enabled changes", () => {
    const handler = vi.fn();
    const Toggle = ({ on }: { on: boolean }) => {
      useHotkeys("k", handler, {
        enabled: on,
      });
      return null;
    };
    const { rerender } = render(<Toggle on={false} />);
    press("k");
    rerender(<Toggle on />);
    press("k");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("works in StrictMode without double firing", () => {
    const handler = vi.fn();
    const Component = () => {
      useHotkeys("k", handler);
      return null;
    };
    render(
      <StrictMode>
        <Component />
      </StrictMode>,
    );
    press("k");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("lets the most recently mounted component win", () => {
    const first = vi.fn();
    const second = vi.fn();
    const A = () => {
      useHotkeys("k", first);
      return null;
    };
    const B = () => {
      useHotkeys("k", second);
      return null;
    };
    render(
      <>
        <A />
        <B />
      </>,
    );
    press("k");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("scopes an element through a ref", () => {
    const handler = vi.fn();
    const Panel = () => {
      const ref = useRef<HTMLDivElement>(null);
      useHotkeys("k", handler, {
        element: ref,
      });
      return (
        <div
          data-testid="panel"
          ref={ref}
        />
      );
    };
    const { getByTestId } = render(<Panel />);
    press("k");
    expect(handler).not.toHaveBeenCalled();
    press("k", {}, getByTestId("panel"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("useHotkeyScope", () => {
  it("traps shortcuts while a modal scope is mounted", () => {
    const behind = vi.fn();
    const close = vi.fn();
    const Modal = () => {
      useHotkeyScope("modal", {
        inherit: false,
      });
      useHotkeys("escape", close, {
        scope: "modal",
      });
      return null;
    };
    const App = ({ open }: { open: boolean }) => {
      useHotkeys("escape", behind);
      return open ? <Modal /> : null;
    };
    const { rerender } = render(<App open />);
    press("Escape", {
      code: "Escape",
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(behind).not.toHaveBeenCalled();
    rerender(<App open={false} />);
    press("Escape", {
      code: "Escape",
    });
    expect(behind).toHaveBeenCalledTimes(1);
  });
});

describe("HotkeysProvider", () => {
  it("isolates instances and accepts a custom one", () => {
    const handler = vi.fn();
    const custom = createHotkeys({
      target: document,
    });
    const Component = () => {
      useHotkeys("k", handler);
      return null;
    };
    render(
      <HotkeysProvider hotkeys={custom}>
        <Component />
      </HotkeysProvider>,
    );
    expect(custom.getBindings()).toHaveLength(1);
    press("k");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
