export interface ExtractedDifferences {
  left: string;
  right: string;
  /** 是否存在行内重复项或两侧共同项 */
  hasDuplicates: boolean;
}

/** 按行拆分并忽略空白行，非空行保留原始缩进与行尾空白 */
function nonEmptyLines(text: string): string[] {
  return text.split(/\r\n?|\n/).filter((line) => line.trim() !== "");
}

/** 提取两侧各自独有的行：先去重，再移除另一侧存在的行 */
export function extractUniqueDifferences(
  leftText: string,
  rightText: string,
): ExtractedDifferences {
  const rawLeftLines = nonEmptyLines(leftText);
  const rawRightLines = nonEmptyLines(rightText);
  const leftLines = [...new Set(rawLeftLines)];
  const rightLines = [...new Set(rawRightLines)];
  const leftSet = new Set(leftLines);
  const rightSet = new Set(rightLines);
  const hasDuplicates =
    leftSet.size !== rawLeftLines.length ||
    rightSet.size !== rawRightLines.length ||
    leftLines.some((line) => rightSet.has(line));

  return {
    left: leftLines.filter((line) => !rightSet.has(line)).join("\n"),
    right: rightLines.filter((line) => !leftSet.has(line)).join("\n"),
    hasDuplicates,
  };
}
