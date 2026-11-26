<script setup>
// 改名/新建文件夹的输入弹窗。图标视图里就地改名的输入框会超出格子、名字长一点就显示不全，
// 所以统一改成弹窗输入（2026-11-26 创始人定）；回车提交、Esc 取消，名字不合规就留在弹窗里提示。
import { computed, nextTick, ref, watch } from "vue";
import { ElDialog, ElInput } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/dialog/style/css";
import "element-plus/es/components/input/style/css";
import { splitName } from "../logic/path";
import { useFm } from "../composables/context";

const fm = useFm();
const input = ref(null);

const open = computed(() => !!fm.renaming);
const isNew = computed(() => !!fm.renaming?.isNew);
const title = computed(() => (isNew.value ? "新建文件夹" : "重命名"));

// 打开后把名字选上：文件夹全选，文件只选主名（后缀一般不用改）
watch(open, async (v) => {
  if (!v) return;
  await nextTick();
  const el = input.value?.input || input.value?.$el?.querySelector("input");
  if (!el) return;
  el.focus();
  const name = fm.renaming.value ?? "";
  const len = fm.renaming.dir ? name.length : splitName(name)[0].length;
  el.setSelectionRange(0, len);
});
// 名字不合规被退回时，重新全选让使用者接着改
watch(
  () => fm.renameRetry,
  async () => {
    if (!open.value) return;
    await nextTick();
    const el = input.value?.input || input.value?.$el?.querySelector("input");
    el?.focus();
    el?.select();
  },
);

function submit() {
  fm.commitRename();
}
</script>

<template>
  <ElDialog
    :model-value="open"
    :title="title"
    width="430px"
    class="fm-dialog"
    append-to-body
    :show-close="false"
    :close-on-click-modal="false"
    @update:model-value="(v) => !v && fm.cancelRename()"
  >
    <ElInput
      ref="input"
      v-model="fm.renaming.value"
      spellcheck="false"
      :placeholder="isNew ? '文件夹名字' : '新名字'"
      @keydown.enter.prevent.stop="submit"
      @keydown.esc.prevent.stop="fm.cancelRename()"
    />
    <template #footer>
      <button class="fm-btn" @click="fm.cancelRename()">取消</button>
      <button class="fm-btn pri" :disabled="!!fm.renaming?.saving" @click="submit">
        {{ isNew ? "创建" : "确定" }}
      </button>
    </template>
  </ElDialog>
</template>
