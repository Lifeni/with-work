/** 根据文本内容猜测语言（返回 Monaco language id），用于编辑器的“自动检测”模式 */
export function detectLanguage(text: string): string {
  const t = text.trim();
  if (!t) return "plaintext";

  // JSON：以 { 或 [ 开头且能完整解析
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      JSON.parse(t);
      return "json";
    } catch {
      // 可能是 JS 对象/数组片段，继续往下判断
    }
  }

  // HTML / XML
  if (/^<!doctype html>/i.test(t) || /<html[\s>]/i.test(t)) return "html";
  if (/<\?xml[\s>]/.test(t) || /^<[a-zA-Z][\s\S]*\/>/.test(t)) return "xml";

  // Markdown
  if (/^#{1,6}\s/m.test(t) || /^\s*([-*+]|\d+\.)\s/m.test(t) || /\*\*[^*\n]+\*\*/m.test(t)) {
    return "markdown";
  }

  // CSS
  if (/(^|\n)\s*[a-zA-Z-][\w-]*\s*\{[^}]*\}/.test(t) && /:[^;]*;/.test(t)) return "css";

  // YAML
  if (/^[a-zA-Z_][\w.-]*\s*:\s*\S/m.test(t)) return "yaml";

  // Python
  if (/^(def |class |import |from |print\()/m.test(t)) return "python";

  // Shell
  if (/^#!\/bin\/(ba)?sh/m.test(t) || /^(echo |ls |cd |cat |grep |rm )/m.test(t)) return "shell";

  // SQL
  if (/^\s*(select|insert|update|delete|create\s+table)\b/i.test(t)) return "sql";

  // JavaScript / TypeScript
  if (/\b(const|let|var|function|import|export|class|=>)\b/.test(t)) {
    if (/\b(interface|type|readonly|implements)\b/.test(t)) return "typescript";
    return "javascript";
  }

  return "plaintext";
}
