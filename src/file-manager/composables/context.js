import { inject } from "vue";

// 文件管理器的上下文：状态都收在 FileManager 这一个组件里，子组件用它取。
// 每个 FileManager 实例提供自己的一份，不是全局单例。
export const FM_KEY = Symbol("ahy-file-manager");

// 子组件取上下文。用在 FileManager 外面直接报错，免得拿到 undefined 到处空指针。
export function useFm() {
  const fm = inject(FM_KEY, null);
  if (!fm) throw new Error("文件管理器的子组件只能放在 FileManager 里用");
  return fm;
}
