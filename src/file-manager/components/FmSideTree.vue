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
