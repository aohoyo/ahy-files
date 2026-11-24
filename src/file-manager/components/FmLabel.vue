<script setup>
// 条目的名字：平时是一行文字，正在就地改名时换成一个输入框。
import { computed, inject, onMounted, ref, watch } from "vue";
import { FM_KEY } from "../composables/context";
import { splitName } from "../logic/path";

const props = defineProps({ entry: { type: Object, required: true } });
const fm = inject(FM_KEY, null);
const input = ref(null);

const editing = computed(() => !!fm && !!fm.renaming && fm.renaming.key === props.entry.key);

// 进编辑态时光标落在名字上：文件夹全选，文件只选主名（后缀一般不用改）
function focusAll() {
  const el = input.value;
  if (!el || !fm.renaming) return;
  el.focus();
  el.setSelectionRange(0, fm.renaming.dir ? props.entry.name.length : splitName(props.entry.name)[0].length);
}
onMounted(focusAll);
// 名字不合规被退回时，重新选中整段让使用者接着改
watch(() => fm?.renameRetry, focusAll);
</script>

<template>
  <input
    v-if="editing"
    ref="input"
    v-model="fm.renaming.value"
    class="fm-rename"
    spellcheck="false"
    @keydown.enter.prevent.stop="fm.commitRename()"
    @keydown.esc.prevent.stop="fm.cancelRename()"
    @mousedown.stop
    @dblclick.stop
    @blur="fm.commitRename()"
  />
  <span v-else class="fm-lbl" :title="entry.name">{{ entry.name }}</span>
</template>
