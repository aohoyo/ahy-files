import { computed, ref } from "vue";

// 选择：单击选一个，Ctrl 加选或减选，Shift 选从锚点到这一项的一段，框选和全选由外面整批给。
// 选的是对象键，不是名字：同一个目录里名字本来就唯一，键在改名、刷新之后也对得上。
export function useSelection() {
  const keys = ref(new Set());
  // 范围选择的起点：最后一次单击或 Ctrl 点的那一项
  const anchor = ref("");
  const count = computed(() => keys.value.size);

  function set(list) {
    keys.value = new Set(list);
  }
  function clear() {
    keys.value = new Set();
    anchor.value = "";
  }
  function only(key) {
    keys.value = new Set([key]);
    anchor.value = key;
  }
  function toggle(key) {
    if (keys.value.has(key)) keys.value.delete(key);
    else keys.value.add(key);
    anchor.value = key;
  }
  // 点击一项时的选择。orderedKeys 是当前显示顺序下的全部键，范围选择按它算。
  function pick(key, ev, orderedKeys) {
    if (ev.shiftKey && anchor.value && orderedKeys.includes(anchor.value)) {
      const a = orderedKeys.indexOf(anchor.value);
      const b = orderedKeys.indexOf(key);
      set(orderedKeys.slice(Math.min(a, b), Math.max(a, b) + 1));
    } else if (ev.ctrlKey || ev.metaKey) {
      toggle(key);
    } else {
      only(key);
    }
  }
  // 列表刷新之后，把已经不在了的键从选择里去掉
  function retain(existing) {
    const kept = [...keys.value].filter((k) => existing.has(k));
    if (kept.length !== keys.value.size) set(kept);
    if (anchor.value && !existing.has(anchor.value)) anchor.value = "";
  }

  return { keys, anchor, count, set, clear, only, toggle, pick, retain };
}
