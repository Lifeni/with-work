/** monaco-editor 的测试替身：提供组件运行时用到的枚举与 Model 工厂（测试模式 alias 指向此文件） */
export const KeyMod = { CtrlCmd: 2048, Shift: 1024, Alt: 512 };
export const KeyCode = {
  KeyF: 36,
  KeyH: 37,
  KeyD: 33,
  KeyL: 38,
  KeyK: 37,
  KeyJ: 36,
  KeyR: 19,
  KeyT: 20,
  KeyU: 45,
  KeyS: 31,
  UpArrow: 16,
  DownArrow: 18,
  Enter: 3,
};

export const editor = {
  TrackedRangeStickiness: {
    NeverGrowsWhenTypingAtEdges: 1,
  },
  createModel: (value = "", language = "plaintext") => {
    let disposed = false;
    let current = value;
    const listeners: Array<() => void> = [];
    const notify = () => listeners.forEach((fn) => fn());

    const lines = () => current.split("\n");
    const posToOffset = (line: number, col: number) => {
      let offset = 0;
      for (let i = 0; i < line - 1; i++) offset += (lines()[i]?.length ?? 0) + 1;
      const lineLen = lines()[line - 1]?.length ?? 0;
      return offset + Math.min(Math.max(col, 1), lineLen + 1) - 1;
    };

    return {
      getValue: () => current,
      setValue: (v: string) => {
        current = v;
        notify();
      },
      getLanguageId: () => language,
      getVersionId: () => 0,
      getLineCount: () => lines().length,
      getFullModelRange: () => ({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: lines().length,
        endColumn: (lines().at(-1)?.length ?? 0) + 1,
      }),
      getValueInRange: (r: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      }) => {
        const start = posToOffset(r.startLineNumber, r.startColumn);
        const end = posToOffset(r.endLineNumber, r.endColumn);
        return current.slice(start, end);
      },
      findMatches: () => [],
      onDidChangeContent: (fn: () => void) => {
        listeners.push(fn);
        return { dispose: () => {} };
      },
      isDisposed: () => disposed,
      dispose: () => {
        disposed = true;
      },
    };
  },
};
