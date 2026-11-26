<script setup>
// 上传进度浮层：贴在右下角，每个文件一行进度，可以收起、取消；全部结束后留着结果等使用者关掉。
import { computed } from "vue";
import FmIcon from "./FmIcon.vue";
import FmFileIcon from "./FmFileIcon.vue";
import { fmtSize } from "../logic/format";
import { useFm } from "../composables/context";

const fm = useFm();
const s = fm.uploads.summary;
const tasks = fm.uploads.tasks;

// 这一批是否都已经有了结果（传完、失败或取消）
const settled = computed(() => !s.value.working && tasks.value.length > 0);
const percent = (t) => (t.size ? Math.round((t.loaded / t.size) * 100) : 100);
const nameOf = (t) => t.rel.split("/").pop();

function toggle() {
  if (settled.value) fm.uploads.close();
  else fm.uploads.panel.small = !fm.uploads.panel.small;
}
</script>

<template>
  <div v-if="fm.uploads.panel.open && tasks.length" class="fm-xf" :class="{ small: fm.uploads.panel.small }">
    <div class="fm-xf-h">
      <span>{{ s.working ? `正在上传 ${s.next}/${s.total}` : s.failed ? `上传完成，${s.failed} 个失败` : "上传完成" }}</span>
      <span v-if="s.working" class="fm-pct">{{ s.percent }}%</span>
      <span class="fm-push" />
      <button class="fm-iconbtn" :title="settled ? '关闭' : '收起'" @click="toggle">
        <FmIcon :name="settled ? 'close' : 'chevronDown'" />
      </button>
      <button v-if="s.working" class="fm-iconbtn" title="取消上传" @click="fm.uploads.cancel()"><FmIcon name="close" /></button>
    </div>
    <div class="fm-xf-body">
      <div v-for="t in tasks" :key="t.id" class="fm-xf-row">
        <FmIcon v-if="t.status === 'done'" name="check" />
        <FmFileIcon v-else :entry="{ key: t.key, name: nameOf(t), dir: false }" :size="20" :thumb="false" />
        <div class="fm-meta">
          <div :title="t.rel">{{ t.rel }}</div>
          <div v-if="t.status === 'done'"><span>已完成 · {{ fmtSize(t.size) }}</span></div>
          <div v-else-if="t.status === 'wait'"><span>等待中</span></div>
          <div v-else-if="t.status === 'error'" class="fm-err" :title="t.error">{{ t.error }}</div>
          <div v-else-if="t.status === 'canceled'" class="fm-err">已取消</div>
          <div v-else>
            <div class="fm-progress"><i :style="{ width: percent(t) + '%' }" /></div>
            <span>{{ fmtSize(t.loaded) }} / {{ fmtSize(t.size) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 上传进度浮层（在 .fm 里面，贴右下角） */
.fm-xf {
  position: absolute;
  right: 12px;
  bottom: 40px;
  z-index: 20;
  width: 340px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.16);
}
.fm-xf.small {
  width: 250px;
}
.fm-xf.small .fm-xf-body {
  display: none;
}
.fm-xf-h {
  height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px 0 14px;
  font-size: 13px;
  font-weight: 600;
}
.fm-xf-h .fm-pct {
  color: var(--el-text-color-regular);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.fm-xf-h .fm-push {
  display: flex;
}
.fm-xf-body {
  max-height: 248px;
  overflow: auto;
  padding: 2px 8px 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.fm-xf-row {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 48px;
  padding: 0 6px;
  border-radius: 4px;
}
.fm-xf-row:hover {
  background: var(--el-fill-color-light);
}
.fm-xf-row > .fm-ico {
  color: var(--el-color-success);
}
.fm-xf-row .fm-meta {
  flex: 1;
  min-width: 0;
}
.fm-xf-row .fm-meta > div:first-child {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fm-xf-row .fm-meta > div:last-child {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.fm-xf-row .fm-err {
  overflow: hidden;
  color: var(--el-color-danger);
  text-overflow: ellipsis;
}
.fm-progress {
  flex: 1;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--el-fill-color);
}
.fm-progress i {
  display: block;
  height: 100%;
  background: var(--el-color-primary);
}
</style>
