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
    return {
      getValue: () => value,
      getLanguageId: () => language,
      isDisposed: () => disposed,
      dispose: () => {
        disposed = true;
      },
    };
  },
};
