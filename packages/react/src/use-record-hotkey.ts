import type { RecordOptions } from "@usehotkeys/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeysInstance } from "./context.js";

/** Options for {@link useRecordHotkey}: the core record options, without the parts the hook manages. */
export type UseRecordHotkeyOptions = Omit<RecordOptions, "onChange" | "signal">;

/** What {@link useRecordHotkey} returns. */
export type RecordHotkeyState = {
  /** `true` between `start()` and the moment a combo is recorded or the recording is cancelled. */
  isRecording: boolean;
  /** What the user is holding right now, e.g. `"mod+shift"`. Empty when nothing is held or not recording. */
  preview: string;
  /** The last combo that was recorded, or `null`. Cancelling keeps the previous value. */
  combo: string | null;
  /** Starts listening. Resolves with the combo, or `null` if cancelled. */
  start: () => Promise<string | null>;
  /** Stops listening without recording anything. */
  cancel: () => void;
};

/**
 * Records the next key combination the user presses, for "customize your shortcuts" screens.
 * While recording, no binding fires. Recording stops by itself when the component unmounts.
 *
 * @example
 * const { start, isRecording, preview, combo } = useRecordHotkey();
 * <button onClick={start}>{isRecording ? preview || "Press keys…" : combo ?? "Set shortcut"}</button>
 */
export function useRecordHotkey(
  options: UseRecordHotkeyOptions = {},
): RecordHotkeyState {
  const hotkeys = useHotkeysInstance();
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState("");
  const [combo, setCombo] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const latestOptions = useRef(options);
  useEffect(() => {
    latestOptions.current = options;
  });

  const cancel = useCallback(() => controller.current?.abort(), []);

  // Stop listening if the component goes away mid-recording.
  useEffect(
    () => cancel,
    [
      cancel,
    ],
  );

  const start = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setIsRecording(true);
    setPreview("");
    const finish = () => {
      if (controller.current === current) {
        controller.current = null;
        setIsRecording(false);
        setPreview("");
      }
    };
    try {
      const result = await hotkeys.record({
        ...latestOptions.current,
        onChange: (value) => {
          if (controller.current === current) {
            setPreview(value);
          }
        },
        signal: current.signal,
      });
      if (result !== null && controller.current === current) {
        setCombo(result);
      }
      finish();
      return result;
    } catch (error) {
      finish();
      throw error;
    }
  }, [
    hotkeys,
  ]);

  return {
    cancel,
    combo,
    isRecording,
    preview,
    start,
  };
}
