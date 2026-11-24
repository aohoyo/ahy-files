<script setup>
// 状态栏：几个项目、选了几项多大，右端的排序与查看。
import { computed } from "vue";
import FmIcon from "./FmIcon.vue";
import { fmtSize } from "../logic/format";
import { useFm } from "../composables/context";

const fm = useFm();

const sortTitle = computed(() => {
  const label = fm.sorts.find((s) => s.key === fm.sort.key)?.label;
  return `排序，当前按${label}${fm.sort.dir > 0 ? "正序" : "倒序"}`;
});
const viewTitle = computed(() => `查看，当前是${fm.views.find(([k]) => k === fm.view)?.[1]}`);

// 状态栏在底部，这两个菜单往上开
function above(ev, items) {
  const r = ev.currentTarget.getBoundingClientRect();
  fm.openMenu(r.right - 198, r.top, items, { up: true });
}
</script>

<template>
  <div class="fm-status">
    <span>{{ fm.query.trim() ? `匹配到 ${fm.visible.length} 个项目` : `${fm.visible.length} 个项目` }}</span>
    <span v-if="fm.selectedCount">已选 {{ fm.selectedCount }} 项{{ fm.selectedSize ? " · " + fmtSize(fm.selectedSize) : "" }}</span>
    <button v-if="fm.hasMore" class="fm-more" :disabled="fm.loadingMore" @click="fm.loadMore()">加载更多</button>
    <span class="fm-push">
      <button class="fm-sbtn" :title="sortTitle" @click="above($event, fm.sortMenu())">
        <FmIcon name="sort" />
      </button>
      <button class="fm-sbtn" :title="viewTitle" @click="above($event, fm.viewMenu())">
        <FmIcon :name="fm.viewIcon" />
      </button>
    </span>
  </div>
</template>
