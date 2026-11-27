<script setup>
// 「移动到」「复制到」：在一棵目录树里选目标文件夹。只能选可写目录；移动时不能选进自己里面。
import { computed, ref, watch } from "vue";
import { ElButton, ElDialog } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/dialog/style/css";
import "element-plus/es/components/button/style/css";
import FmIcon from "./FmIcon.vue";
import { iconSvg } from "../icons";
import { isUnder, parentDir } from "../logic/path";
import { useFm } from "../composables/context";

const fm = useFm();
const entries = computed(() => fm.moveDialog?.entries || []);
const isMove = computed(() => fm.moveDialog?.mode === "cut");
const target = ref("");
const busy = ref(false);
const close = () => (fm.moveDialog = null);

// 这一项目录为什么不能当目标：只读，或者正在把文件夹移进它自己里面
function blocked(key) {
  if (!fm.canWriteDir(key)) return "这个目录只读";
  if (isMove.value && entries.value.some((e) => e.dir && isUnder(key, e.key))) return "不能把文件夹移到它自己里面";
  return "";
}
const hint = computed(() => blocked(target.value));

// 打开时的默认目标：复制默认留在当前目录（留一份副本）；移动默认选上一级的可写目录，
// 因为在原处移动等于什么也不做。都不行就选第一个能当目标的可写目录。
watch(
  () => fm.moveDialog,
  (d) => {
    if (!d) return;
    const parent = parentDir(fm.path);
    if (!isMove.value && fm.canWriteDir(fm.path)) target.value = fm.path;
    else if (parent != null && !blocked(parent)) target.value = parent;
    else target.value = fm.writableRoots.find((r) => !blocked(r)) ?? "";
  },
);

function onRow(row, ev) {
  if (ev.target.closest(".fm-tw")) {
    fm.toggleTree(row.key);
    return;
  }
  if (!blocked(row.key)) target.value = row.key;
}

// 在选中的目录里现建一个文件夹并选中它。权限与查重走 fm.createFolderAt——
// 弹窗不自己摸 api，免得绕过命令栏同一套权限
async function newFolder() {
  if (busy.value) return;
  busy.value = true;
  try {
    const dir = await fm.createFolderAt(target.value);
    if (!dir) return;
    fm.invalidateTree([dir]);
    await fm.syncTree(dir);
    target.value = dir;
    fm.toast(`已新建文件夹「${dir.split("/").filter(Boolean).pop()}」`, "success");
  } catch (e) {
    fm.toast(e?.message || "新建文件夹失败", "error");
  } finally {
    busy.value = false;
  }
}

function confirm() {
  if (hint.value || busy.value) return;
  fm.doTransfer(target.value);
}
</script>

<template>
  <ElDialog
    :model-value="entries.length > 0"
    width="540px"
    class="fm-dialog"
    append-to-body
    :show-close="false"
    :close-on-click-modal="false"
    @update:model-value="(v) => !v && close()"
  >
    <template #header>
      <div class="fm-dlg-head">
        <span class="fm-dlg-title">{{ isMove ? "移动到" : "复制到" }}</span>
        <span class="fm-dialog-hint">为这 {{ entries.length }} 项选一个目标文件夹</span>
        <span class="fm-push" />
        <button class="fm-iconbtn" title="关闭" @click="close"><FmIcon name="close" /></button>
      </div>
    </template>

    <div class="fm-dlg-body">
    <div class="fm-picker">
      <div
        v-for="row in fm.treeRows"
        :key="row.key"
        class="fm-prow"
        :class="{ cur: row.key === target, dis: !!blocked(row.key) }"
        :style="{ paddingLeft: 6 + row.depth * 16 + 'px' }"
        :title="row.key || '根目录'"
        @click="onRow(row, $event)"
      >
        <span class="fm-tw">
          <FmIcon v-if="row.has && row.key" :name="row.open ? 'chevronDown' : 'chevronRight'" />
        </span>
        <span class="fm-ficon" style="width: 15px; height: 15px; color: #f0b13b" v-html="iconSvg('folderFill')" />
        <span class="fm-nm">{{ row.name }}</span>
      </div>
    </div>
    <div class="fm-picker-hint">{{ hint }}</div>
    </div>
    <template #footer>
      <div class="fm-dlg-foot">
        <ElButton style="margin-right: auto" size="small" :disabled="busy || !fm.canWriteDir(target)" @click="newFolder">新建文件夹</ElButton>
        <ElButton @click="close">取消</ElButton>
        <ElButton type="primary" :disabled="busy || !!hint" @click="confirm">{{ isMove ? "移动" : "复制" }}</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
/* 移动到 / 复制到：选目标文件夹 */
.fm-picker {
  height: 320px;
  overflow: auto;
  margin-top: 10px;
  padding: 6px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}
.fm-prow {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding-right: 6px;
  border-radius: 4px;
  white-space: nowrap;
  cursor: pointer;
}
.fm-prow:hover {
  background: var(--el-fill-color-light);
}
.fm-prow.cur {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.fm-prow.dis {
  color: var(--el-text-color-disabled);
  cursor: default;
}
.fm-prow.dis:hover {
  background: none;
}
.fm-picker-hint {
  min-height: 18px;
  margin-top: 8px;
  color: var(--el-color-danger);
  font-size: 12.5px;
}
</style>
