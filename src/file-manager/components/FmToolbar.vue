<script setup>
// 工具栏：后退、前进、上一级、刷新，地址栏的面包屑，搜索当前目录。
import { ElInput } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/input/style/css";
import FmIcon from "./FmIcon.vue";
import { useFm } from "../composables/context";

const fm = useFm();
</script>

<template>
  <div class="fm-bar fm-toolbar">
    <button class="fm-navbtn" :disabled="!fm.canBack" title="后退" @click="fm.back()"><FmIcon name="navBack" /></button>
    <button class="fm-navbtn" :disabled="!fm.canForward" title="前进" @click="fm.forward()"><FmIcon name="navForward" /></button>
    <button class="fm-navbtn" :disabled="!fm.canUp" title="上一级" @click="fm.up()"><FmIcon name="navUp" /></button>
    <button class="fm-navbtn" :class="{ spin: fm.spinning }" title="刷新" @click="fm.refresh()"><FmIcon name="refresh" /></button>

    <div class="fm-addr">
      <FmIcon name="hardDrive" />
      <template v-for="(c, i) in fm.crumbs" :key="c.path">
        <span v-if="i" class="fm-sep">›</span>
        <button class="fm-crumb" :class="{ cur: i === fm.crumbs.length - 1 }" :title="c.path || '根目录'" @click="fm.go(c.path)">
          {{ c.name }}
        </button>
      </template>
      <span v-if="!fm.writable" class="fm-ro" title="这个目录只能浏览，不能改动"><FmIcon name="lockClosed" />只读</span>
    </div>

    <ElInput
      v-model="fm.query"
      class="fm-search"
      placeholder="搜索当前目录"
      clearable
      spellcheck="false"
      @keydown.esc.stop="fm.query = ''"
    >
      <template #prefix><FmIcon name="search" /></template>
    </ElInput>
  </div>
</template>

<style scoped>
/* ---------- 工具栏：前进后退、地址栏、搜索 ---------- */
.fm-toolbar {
  height: 48px;
}
.fm-navbtn {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
}
.fm-navbtn:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}
.fm-navbtn:disabled {
  color: var(--el-text-color-disabled);
  cursor: default;
}
.fm-navbtn.spin .fm-ico {
  animation: fm-spin 0.6s linear;
}
@keyframes fm-spin {
  to {
    transform: rotate(360deg);
  }
}
.fm-addr {
  flex: 1;
  min-width: 0;
  height: 32px;
  display: flex;
  align-items: center;
  margin: 0 6px;
  padding: 0 4px 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}
.fm-addr:hover {
  border-color: var(--el-text-color-disabled);
}
.fm-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 7px;
  border: 0;
  border-radius: 3px;
  background: none;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
.fm-crumb:hover {
  background: var(--el-fill-color-light);
}
.fm-crumb.cur {
  font-weight: 600;
}
.fm-addr .fm-sep {
  width: 12px;
  flex-shrink: 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.fm-addr > .fm-ico {
  color: var(--el-text-color-secondary);
}
.fm-ro {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 22px;
  margin-left: 6px;
  padding: 0 8px;
  border-radius: 11px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}
/* 搜索框：ElInput 只调宽度与悬停边色，内部长相归 Element 官方变量管 */
.fm-search {
  width: 250px;
  flex-shrink: 0;
  --el-input-hover-border-color: var(--el-text-color-disabled);
}
</style>
