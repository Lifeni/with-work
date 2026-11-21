/** 兼容 DOMStringList 与普通字符串数组的拖拽类型判断。 */
export function hasDragType(
  types: readonly string[] | DOMStringList | undefined,
  type: string,
): boolean {
  if (!types) return false;
  if (Array.isArray(types)) return types.includes(type);
  return (types as DOMStringList).contains?.(type) ?? false;
}
