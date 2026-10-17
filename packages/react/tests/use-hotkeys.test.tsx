import { act, cleanup, render } from "@testing-library/react";
import { createHotkeys } from "@usehotkeys/core";
import { type ReactNode, StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HotkeysProvider,
  useBindings,
  useHotkeyAction,
  useHotkeyScope,
  useHotkeys,
  useHotkeysInstance,
  useRecordHotkey,
  useShortcuts,
} from "../src/index.js";

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

describe("sequences", () => {
  it("accepts sequence strings", () => {
    const handler = vi.fn();
    const Component = () => {
      useHotkeys("g i", handler);
      return null;
    };
    render(<Component />);
    press("g");
    press("i");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("useRecordHotkey", () => {
  const Recorder = () => {
    const { combo, isRecording, preview, start } = useRecordHotkey();
    return (
      <button
        onClick={() => void start()}
        type="button"
      >
        {isRecording ? `recording:${preview}` : `combo:${combo ?? "none"}`}
      </button>
    );
  };

  it("records a combo and exposes progress", async () => {
    const { getByRole } = render(<Recorder />);
    const button = getByRole("button");
    expect(button.textContent).toBe("combo:none");
    act(() => button.click());
    expect(button.textContent).toBe("recording:");
    press("Control", {
      code: "ControlLeft",
      ctrlKey: true,
    });
    expect(button.textContent).toBe("recording:mod");
    await act(async () => {
      press("k", {
        ctrlKey: true,
      });
    });
    expect(button.textContent).toBe("combo:mod+k");
  });

  it("keeps the previous combo when cancelled and stops on unmount", async () => {
    const { getByRole, unmount } = render(<Recorder />);
    const button = getByRole("button");
    act(() => button.click());
    await act(async () => {
      press("Escape", {
        code: "Escape",
      });
    });
    expect(button.textContent).toBe("combo:none");
    act(() => button.click());
    unmount();
    const handler = vi.fn();
    const probe = createHotkeys({
      target: document,
    });
    probe.bind("k", handler);
    press("k");
    expect(handler).toHaveBeenCalledTimes(1);
    probe.destroy();
  });
});

describe("useBindings", () => {
  const isolated = (children: ReactNode, options = {}) => (
    <HotkeysProvider
      options={{
        platform: "other",
        ...options,
      }}
    >
      {children}
    </HotkeysProvider>
  );

  it("lists registered shortcuts and updates as components mount and unmount", () => {
    const List = () => {
      const bindings = useBindings({
        labeledOnly: true,
      });
      return (
        <ul data-testid="list">
          {bindings.map((binding) => (
            <li key={binding.id}>{binding.label}</li>
          ))}
        </ul>
      );
    };
    const Feature = () => {
      useHotkeys("mod+k", () => {}, {
        label: "Open palette",
      });
      useHotkeys("x", () => {});
      return null;
    };
    const App = ({ show }: { show: boolean }) =>
      isolated(
        <>
          <List />
          {show ? <Feature /> : null}
        </>,
      );
    const { getByTestId, rerender } = render(<App show={false} />);
    expect(getByTestId("list").textContent).toBe("");
    rerender(<App show />);
    expect(getByTestId("list").textContent).toBe("Open palette");
    rerender(<App show={false} />);
    expect(getByTestId("list").textContent).toBe("");
  });

  it("filters by activeOnly and group, and reacts to scopes and enabled", () => {
    const List = () => {
      const active = useBindings({
        activeOnly: true,
        group: "Editor",
      });
      return (
        <p data-testid="active">
          {active.map((binding) => binding.label).join(",")}
        </p>
      );
    };
    const Feature = ({ enabled }: { enabled: boolean }) => {
      useHotkeys("b", () => {}, {
        enabled,
        group: "Editor",
        label: "Bold",
        scope: "editor",
      });
      useHotkeys("i", () => {}, {
        group: "Other",
        label: "Italic",
      });
      return null;
    };
    const Scope = ({ on }: { on: boolean }) => {
      useHotkeyScope("editor", {
        enabled: on,
      });
      return null;
    };
    const App = ({ enabled, scope }: { enabled: boolean; scope: boolean }) =>
      isolated(
        <>
          <List />
          <Feature enabled={enabled} />
          <Scope on={scope} />
        </>,
      );
    const { getByTestId, rerender } = render(
      <App
        enabled
        scope={false}
      />,
    );
    expect(getByTestId("active").textContent).toBe("");
    rerender(
      <App
        enabled
        scope
      />,
    );
    expect(getByTestId("active").textContent).toBe("Bold");
    rerender(
      <App
        enabled={false}
        scope
      />,
    );
    expect(getByTestId("active").textContent).toBe("");
  });
});

describe("keymap hooks", () => {
  const keymap = {
    open: {
      group: "Nav",
      keys: "mod+k",
      label: "Open",
    },
  };

  it("useHotkeyAction follows setShortcut and useShortcuts reflects it", () => {
    const handler = vi.fn();
    let instance: ReturnType<typeof useHotkeysInstance> | undefined;
    const Probe = () => {
      instance = useHotkeysInstance();
      useHotkeyAction("open", handler);
      const shortcuts = useShortcuts();
      return (
        <p data-testid="keys">
          {shortcuts.map((shortcut) => shortcut.keys.join("|")).join(",")}
        </p>
      );
    };
    const { getByTestId } = render(
      <HotkeysProvider
        options={{
          keymap,
          platform: "other",
        }}
      >
        <Probe />
      </HotkeysProvider>,
    );
    expect(getByTestId("keys").textContent).toBe("mod+k");
    press("k", {
      ctrlKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    act(() => instance?.setShortcut("open", "mod+p"));
    expect(getByTestId("keys").textContent).toBe("mod+p");
    press("k", {
      ctrlKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    press("p", {
      ctrlKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
