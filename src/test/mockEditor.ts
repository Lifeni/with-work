import type * as monaco from "monaco-editor";

/** 供组件测试使用的 Monaco 编辑器 / 模型轻量 mock（真实编辑器行为交给 E2E） */

export interface MockRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface MockModel {
  getValue: () => string;
  setValue: (v: string) => void;
  getValueInRange: (r: MockRange) => string;
  getFullModelRange: () => MockRange;
  findMatches: (
    query: string,
    searchOnlyEditableRange: boolean,
    isRegex: boolean,
    matchCase: boolean,
    wordSeparators: unknown,
    captureMatches: boolean,
    limitResultCount: number,
  ) => Array<{ range: MockRange; matches?: string[] }>;
  onDidChangeContent: (fn: () => void) => { dispose: () => void };
  getLineCount: () => number;
}

export interface MockEditor {
  editor: monaco.editor.IStandaloneCodeEditor;
  model: MockModel;
  /** executeEdits 调用记录，便于断言 */
  editsLog: Array<{ source: string; edits: Array<{ range: MockRange; text: string }> }>;
  getValue: () => string;
  setValue: (v: string) => void;
}

export interface MockEditorOptions {
  /** 初始选区；默认光标位于 1:1（空选区）。传 null 表示无选区 */
  selection?: MockRange | null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createMockEditor(initialValue = "", options: MockEditorOptions = {}): MockEditor {
  let value = initialValue;
  let editorDisposed = false;
  const selection: MockRange | null =
    options.selection ??
    ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } satisfies MockRange);
  const contentListeners: Array<() => void> = [];

  const notify = () => contentListeners.forEach((fn) => fn());

  const posToOffset = (line: number, col: number) => {
    const lines = value.split("\n");
    let offset = 0;
    for (let i = 0; i < line - 1; i++) offset += (lines[i]?.length ?? 0) + 1;
    const lineLen = lines[line - 1]?.length ?? 0;
    return offset + Math.min(Math.max(col, 1), lineLen + 1) - 1;
  };

  const offsetToPos = (offset: number) => {
    const before = value.slice(0, offset);
    const lines = before.split("\n");
    return { line: lines.length, col: (lines[lines.length - 1]?.length ?? 0) + 1 };
  };

  const rangeToText = (r: MockRange) => {
    const lines = value.split("\n");
    if (r.startLineNumber === r.endLineNumber) {
      return lines[r.startLineNumber - 1]?.slice(r.startColumn - 1, r.endColumn - 1) ?? "";
    }
    const parts: string[] = [];
    for (let i = r.startLineNumber; i <= r.endLineNumber; i++) {
      const line = lines[i - 1] ?? "";
      if (i === r.startLineNumber) parts.push(line.slice(r.startColumn - 1));
      else if (i === r.endLineNumber) parts.push(line.slice(0, r.endColumn - 1));
      else parts.push(line);
    }
    return parts.join("\n");
  };

  const applyEdit = (r: MockRange, text: string) => {
    const start = posToOffset(r.startLineNumber, r.startColumn);
    const end = posToOffset(r.endLineNumber, r.endColumn);
    value = value.slice(0, start) + text + value.slice(end);
    notify();
  };

  const editsLog: MockEditor["editsLog"] = [];

  const model: MockModel = {
    getValue: () => value,
    setValue: (v) => {
      value = v;
      notify();
    },
    getValueInRange: (r) => rangeToText(r),
    getFullModelRange: () => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: value.split("\n").length,
      endColumn: (value.split("\n").at(-1)?.length ?? 0) + 1,
    }),
    findMatches: (query, _sr, isRegex, matchCase, _ws, captureMatches) => {
      if (!query) return [];
      const flags = "g" + (isRegex || matchCase ? "" : "i");
      let re: RegExp;
      try {
        re = new RegExp(isRegex ? query : escapeRegExp(query), flags);
      } catch {
        return [];
      }
      const results: Array<{ range: MockRange; matches?: string[] }> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(value)) !== null) {
        const pos = offsetToPos(m.index);
        results.push({
          range: {
            startLineNumber: pos.line,
            startColumn: pos.col,
            endLineNumber: pos.line,
            endColumn: pos.col + m[0].length,
          },
          matches: captureMatches ? [...m] : undefined,
        });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      return results;
    },
    onDidChangeContent: (fn) => {
      contentListeners.push(fn);
      return { dispose: () => {} };
    },
    getLineCount: () => value.split("\n").length,
  };

  const getSelection = () =>
    selection
      ? {
          ...selection,
          isEmpty: () =>
            selection !== null &&
            selection.startLineNumber === selection.endLineNumber &&
            selection.startColumn === selection.endColumn,
        }
      : null;

  const editor = {
    getModel: () => model,
    getSelection,
    /** 模拟 Monaco：实例 dispose 后调用 setModel 会访问已释放对象并抛异常（编辑器生命周期 bug 的崩溃路径） */
    setModel: () => {
      if (editorDisposed) throw new Error("编辑器实例已释放（模拟 Monaco 崩溃）");
    },
    onDidFocusEditorText: () => ({ dispose: () => {} }),
    onDidChangeCursorPosition: () => ({ dispose: () => {} }),
    addCommand: () => {},
    addAction: () => {},
    getTargetAtClientPoint: () => null,
    executeEdits: (source: string, edits: Array<{ range: MockRange; text: string }>) => {
      editsLog.push({ source, edits });
      // 从后往前应用，保证多编辑的正确性
      const sorted = [...edits].sort(
        (a, b) =>
          posToOffset(b.range.startLineNumber, b.range.startColumn) -
          posToOffset(a.range.startLineNumber, a.range.startColumn),
      );
      for (const e of sorted) applyEdit(e.range, e.text);
      return true;
    },
    createDecorationsCollection: () => ({ set: () => {}, clear: () => {} }),
    revealRangeInCenter: () => {},
    setPosition: () => {},
    focus: () => {},
    trigger: () => {},
    // 测试辅助：模拟 @monaco-editor/react 卸载时 dispose 实例
    _markDisposed: () => {
      editorDisposed = true;
    },
  } as unknown as monaco.editor.IStandaloneCodeEditor;

  return {
    editor,
    model,
    editsLog,
    getValue: () => value,
    setValue: (v) => model.setValue(v),
  };
}
