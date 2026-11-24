import { computed, ref } from "vue";
import { parentDir, toDir } from "../logic/path";

// 路径与前进后退。历史是一条栈，hi 指向当前位置；走到一半又岔开时，丢掉前面的路。
export function useNavigation(start = "") {
  const path = ref(toDir(start));
  const history = ref([path.value]);
  const hi = ref(0);

  const canBack = computed(() => hi.value > 0);
  const canForward = computed(() => hi.value < history.value.length - 1);
  const canUp = computed(() => path.value !== "");

  // 去另一个目录。push 为假是在历史里走（后退、前进），不新增记录。
  function go(next, push = true) {
    const p = toDir(next);
    if (p === path.value) return;
    if (push) {
      history.value = [...history.value.slice(0, hi.value + 1), p];
      hi.value = history.value.length - 1;
    }
    path.value = p;
  }

  // 后退、前进只在历史里挪位置指针，不新增记录
  const back = () => stepTo(hi.value - 1);
  const forward = () => stepTo(hi.value + 1);
  function stepTo(index) {
    if (index < 0 || index >= history.value.length) return;
    hi.value = index;
    path.value = history.value[index];
  }
  const up = () => canUp.value && go(parentDir(path.value));

  return { path, canBack, canForward, canUp, go, back, forward, up };
}
