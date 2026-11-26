<script setup>
// 左侧快速访问：根目录起头的目录树，展开当前所在的路径。子目录看过了才记，没看过的先留一个展开箭头。
import FmIcon from "./FmIcon.vue";
import { iconSvg } from "../icons";
import { useFm } from "../composables/context";

const fm = useFm();
</script>

<template>
  <div class="fm-tree">
    <div class="fm-tree-title">快速访问</div>
    <div
      v-for="row in fm.treeRows"
      :key="row.key"
      class="fm-node"
      :class="{ cur: row.key === fm.path }"
      :style="{ paddingLeft: 6 + row.depth * 16 + 'px' }"
      :title="row.key || '根目录'"
      @click="fm.go(row.key)"
    >
      <span class="fm-tw" @click.stop="fm.toggleTree(row.key)">
        <FmIcon v-if="row.has && row.key" :name="row.open ? 'chevronDown' : 'chevronRight'" />
      </span>
      <span class="fm-ficon" style="width: 15px; height: 15px; color: #f0b13b" v-html="iconSvg('folderFill')" />
      <span class="fm-nm">{{ row.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.fm-tree {
  width: 212px;
  flex-shrink: 0;
  padding: 8px 6px;
  overflow: auto;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
}
.fm-tree-title {
  padding: 6px 8px 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.fm-node {
  display: flex;
  align-items: center;
  height: 30px;
  padding-right: 6px;
  border-radius: 4px;
  white-space: nowrap;
  cursor: pointer;
}
.fm-node:hover {
  background: var(--el-fill-color-light);
}
.fm-node.cur {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.fm-nm {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
