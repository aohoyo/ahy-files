<script setup>
// 命令栏：选中什么亮什么，没选中或没权限的置灰，悬停能看到原因。右端是排序与查看。
import FmIcon from "./FmIcon.vue";
import { useFm } from "../composables/context";

const fm = useFm();

// 菜单贴着按钮下沿打开；右端的两个靠右对齐
function below(ev, items) {
  const r = ev.currentTarget.getBoundingClientRect();
  fm.openMenu(r.left, r.bottom + 4, items, { above: r.top });
}
function belowRight(ev, items) {
  const r = ev.currentTarget.getBoundingClientRect();
  fm.openMenu(r.right - 198, r.bottom + 4, items, { above: r.top });
}
const moreMenu = () => [
  { icon: "moveTo", label: "移动到", disabled: !!fm.cmd.moveTo, onClick: () => fm.askTransfer("cut") },
  { icon: "copy", label: "复制到", disabled: !!fm.cmd.copyTo, onClick: () => fm.askTransfer("copy") },
];
</script>

<template>
  <div class="fm-bar fm-command">
    <button class="fm-cmd" :disabled="!!fm.cmd.create" :title="fm.cmd.create" @click="fm.startNewFolder()">
      <FmIcon name="add" /><span>新建文件夹</span>
    </button>
    <button class="fm-cmd" :disabled="!!fm.cmd.upload" :title="fm.cmd.upload" @click="below($event, fm.uploadMenu())">
      <FmIcon name="upload" /><span>上传</span><span class="fm-dd"><FmIcon name="chevronDown" /></span>
    </button>
    <div class="fm-vsep" />
    <button class="fm-cmd" :disabled="!!fm.cmd.cut" :title="fm.cmd.cut" @click="fm.cutOrCopy('cut')">
      <FmIcon name="cut" /><span>剪切</span>
    </button>
    <button class="fm-cmd" :disabled="!!fm.cmd.copy" :title="fm.cmd.copy" @click="fm.cutOrCopy('copy')">
      <FmIcon name="copy" /><span>复制</span>
    </button>
    <button class="fm-cmd" :disabled="!!fm.cmd.paste" :title="fm.cmd.paste" @click="fm.paste()">
      <FmIcon name="paste" /><span>粘贴</span>
    </button>
    <div class="fm-vsep" />
    <button class="fm-cmd" :disabled="!!fm.cmd.rename" :title="fm.cmd.rename" @click="fm.startRename()">
      <FmIcon name="edit" /><span>重命名</span>
    </button>
    <button class="fm-cmd" :disabled="!!fm.cmd.delete" :title="fm.cmd.delete" @click="fm.askDelete()">
      <FmIcon name="delete" /><span>删除</span>
    </button>
    <button class="fm-cmd" :disabled="!!fm.cmd.more" :title="fm.cmd.more" @click="below($event, moreMenu())">
      <FmIcon name="more" /><span>更多</span>
    </button>
    <div class="fm-vsep" />
    <button class="fm-cmd" :disabled="!!fm.cmd.download" :title="fm.cmd.download" @click="fm.download(fm.selected)">
      <FmIcon name="download" /><span>下载</span>
    </button>
    <button class="fm-cmd" :disabled="!!fm.cmd.link" :title="fm.cmd.link" @click="fm.copyLink(fm.selectedFiles)">
      <FmIcon name="link" /><span>复制链接</span>
    </button>

    <span class="fm-push" />
    <button class="fm-cmdline" @click="belowRight($event, fm.sortMenu())">
      <FmIcon name="sort" /><span>排序</span><span class="fm-caret"><FmIcon name="chevronDown" /></span>
    </button>
    <button class="fm-cmdline" @click="belowRight($event, fm.viewMenu())">
      <FmIcon name="viewGrid" /><span>查看</span><span class="fm-caret"><FmIcon name="chevronDown" /></span>
    </button>
  </div>
</template>

<style scoped>
/* ---------- 命令栏 ---------- */
.fm-command {
  min-height: 60px;
  gap: 0;
  padding: 4px 10px;
}
.fm-cmd {
  position: relative;
  height: 50px;
  min-width: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 3px 10px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  user-select: none;
}
.fm-cmd .fm-ico :deep(svg) {
  width: 20px;
  height: 20px;
}
.fm-cmd:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}
.fm-cmd:disabled {
  color: var(--el-text-color-disabled);
  cursor: default;
}
.fm-cmd .fm-dd {
  position: absolute;
  top: 5px;
  right: 5px;
}
.fm-cmd .fm-dd :deep(svg) {
  width: 10px;
  height: 10px;
}
.fm-vsep {
  width: 1px;
  height: 32px;
  flex-shrink: 0;
  margin: 0 10px;
  background: var(--el-border-color-lighter);
}
.fm-cmdline {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 2px;
  padding: 0 10px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.fm-cmdline:hover {
  background: var(--el-fill-color-light);
}
.fm-cmdline .fm-ico :deep(svg) {
  width: 18px;
  height: 18px;
}
.fm-cmdline .fm-caret {
  color: var(--el-text-color-secondary);
}
</style>
