<script setup>
// 状态栏：几个项目、选了几项多大。排序与查看只在命令栏有一处——
// 状态栏再放一份纯粹重复（2026-11-26 创始人指出）。
import { fmtSize } from "../logic/format";
import { useFm } from "../composables/context";

const fm = useFm();
</script>

<template>
  <div class="fm-status">
    <span>{{ fm.query.trim() ? `匹配到 ${fm.visible.length} 个项目` : `${fm.visible.length} 个项目` }}</span>
    <span v-if="fm.selectedCount">已选 {{ fm.selectedCount }} 项{{ fm.selectedSize ? " · " + fmtSize(fm.selectedSize) : "" }}</span>
    <button v-if="fm.hasMore" class="fm-more" :disabled="fm.loadingMore" @click="fm.loadMore()">加载更多</button>
  </div>
</template>
