<script setup>
// 删除前的确认：真删、没有回收站，把要删的名字逐个列出来防看串行（单项也列，删文件夹时最容易看错）。
import { computed } from "vue";
import { ElButton, ElDialog } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/dialog/style/css";
import "element-plus/es/components/button/style/css";
import FmIcon from "./FmIcon.vue";
import { useFm } from "../composables/context";

const fm = useFm();
const list = computed(() => fm.confirmDelete || []);
const dirs = computed(() => list.value.filter((e) => e.dir).length);
const close = () => (fm.confirmDelete = null);
</script>

<template>
  <ElDialog
    :model-value="list.length > 0"
    width="430px"
    class="fm-dialog"
    append-to-body
    :show-close="false"
    :close-on-click-modal="false"
    @update:model-value="(v) => !v && close()"
  >
    <template #header>
      <div class="fm-dlg-head"><span class="fm-dlg-title">删除文件</span></div>
    </template>
    <div class="fm-dlg-body">
    <div class="fm-warnrow">
      <FmIcon name="warning" />
      <div>
        <b>确定删除这 {{ list.length }} 项吗？</b>
        {{ dirs ? `其中有 ${dirs} 个文件夹，里面的内容会一并删除。` : "" }}删除后无法恢复。
      </div>
    </div>
    <!-- 单项也把名字显出来：删文件夹时看不见是哪个，误删风险最大（交叉审 P2） -->
    <div class="fm-dellist">
      <div v-for="e in list" :key="e.key">{{ e.dir ? e.key : e.name }}</div>
    </div>
    </div>
    <template #footer>
      <div class="fm-dlg-foot">
        <ElButton @click="close">取消</ElButton>
        <ElButton type="danger" :disabled="!!fm.busy" @click="fm.doDelete()">删除</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.fm-warnrow {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.fm-warnrow > .fm-ico {
  margin-top: 2px;
  color: var(--el-color-danger);
}
.fm-warnrow > .fm-ico :deep(svg) {
  width: 20px;
  height: 20px;
}
.fm-warnrow b {
  display: block;
  margin-bottom: 4px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}
.fm-dellist {
  max-height: 118px;
  margin: 10px 0 0 32px;
  padding: 8px 12px;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.8;
  word-break: break-all;
}
</style>
