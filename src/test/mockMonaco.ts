/** monaco-editor 的测试替身：提供组件运行时用到的枚举与 Model 工厂（测试模式 alias 指向此文件） */
export const KeyMod = { CtrlCmd: 2048 };
export const KeyCode = { KeyF: 36, KeyH: 37 };

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
