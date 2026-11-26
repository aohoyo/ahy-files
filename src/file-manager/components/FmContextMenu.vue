<script setup>
// 右键菜单（命令栏的排序、查看、上传也用它）。传送到 body 下，贴着窗口边缘放不下时自动往里收或往上翻。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useZIndex } from "element-plus/es";
import FmIcon from "./FmIcon.vue";
import { useFm } from "../composables/context";

const fm = useFm();
// 和 Element Plus 的弹层共用一个层级计数器，菜单永远盖在当前开着的弹层上面
const { nextZIndex } = useZIndex();

const rootEl = ref(null);
const subEl = ref(null);
const pos = ref({ left: 0, top: 0 });
const subPos = ref({ left: 0, top: 0 });
const zIndex = ref(2000);
// 展开着的子菜单：主菜单的第几项、它的条目
const sub = ref(null);

const items = computed(() => fm.menu?.items || []);

// 放到不超出窗口的位置。above 是触发按钮的上沿：下面放不下就翻到按钮上面去。
function place(el, x, y, above, up) {
  let left = Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8));
  let top = up ? y - el.offsetHeight - 4 : y;
  if (!up && top + el.offsetHeight > window.innerHeight - 8) {
    top = above != null ? above - el.offsetHeight - 4 : window.innerHeight - el.offsetHeight - 8;
  }
  return { left, top };
}

watch(
  () => fm.menu,
  async (m) => {
    sub.value = null;
    if (!m) return;
    zIndex.value = nextZIndex();
    await nextTick();
    if (rootEl.value) pos.value = place(rootEl.value, m.x, m.y, m.above, m.up);
  },
);

// 鼠标停在带子菜单的项上就展开；子菜单默认开在右边，右边放不下就开到左边
async function hover(it, ev) {
  if (it.disabled) return;
  if (!it.sub) {
    sub.value = null;
    return;
  }
  const r = ev.currentTarget.getBoundingClientRect();
  sub.value = typeof it.sub === "function" ? it.sub() : it.sub;
  await nextTick();
  if (subEl.value) {
    const x = r.right - 4 + subEl.value.offsetWidth > window.innerWidth - 8 ? r.left - subEl.value.offsetWidth + 4 : r.right - 4;
    subPos.value = place(subEl.value, x, r.top - 5, null, false);
  }
}

function click(it) {
  if (it.disabled || it.sub) return;
  fm.closeMenu();
  it.onClick?.();
}

// 点到菜单外面、滚动、窗口大小变了，都收起
function onOutside(ev) {
  if (!ev.target.closest?.(".fm-menu")) fm.closeMenu();
}
function onScroll(ev) {
  if (!ev.target.closest?.(".fm-menu")) fm.closeMenu();
}
onMounted(() => {
  document.addEventListener("mousedown", onOutside, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", fm.closeMenu);
  window.addEventListener("blur", fm.closeMenu);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onOutside, true);
  window.removeEventListener("scroll", onScroll, true);
  window.removeEventListener("resize", fm.closeMenu);
  window.removeEventListener("blur", fm.closeMenu);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="fm.menu"
      ref="rootEl"
      class="fm-menu"
      :style="{ left: pos.left + 'px', top: pos.top + 'px', zIndex }"
      @contextmenu.prevent
      @mousedown.stop
    >
      <template v-for="(it, i) in items" :key="i">
        <div v-if="it === '-'" class="fm-menu-sep" />
        <button v-else class="fm-menu-item" :disabled="it.disabled" @mouseenter="hover(it, $event)" @click="click(it)">
          <FmIcon :name="it.icon" /><span>{{ it.label }}</span>
          <span v-if="it.sub" class="fm-tail"><FmIcon name="chevronRight" /></span>
          <span v-else-if="it.checked" class="fm-tail"><FmIcon name="check" /></span>
          <em v-else-if="it.key">{{ it.key }}</em>
        </button>
      </template>
    </div>
    <div
      v-if="sub && fm.menu"
      ref="subEl"
      class="fm-menu"
      :style="{ left: subPos.left + 'px', top: subPos.top + 'px', zIndex }"
      @contextmenu.prevent
      @mousedown.stop
    >
      <template v-for="(it, i) in sub" :key="i">
        <div v-if="it === '-'" class="fm-menu-sep" />
        <button v-else class="fm-menu-item" :disabled="it.disabled" @click="click(it)">
          <FmIcon :name="it.icon" /><span>{{ it.label }}</span>
          <span v-if="it.checked" class="fm-tail"><FmIcon name="check" /></span>
          <em v-else-if="it.key">{{ it.key }}</em>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
/* 右键菜单 */
.fm-menu {
  position: fixed;
  min-width: 198px;
  padding: 5px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 7px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.fm-menu-item {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 9px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: default;
}
.fm-menu-item:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}
.fm-menu-item:disabled {
  color: var(--el-text-color-disabled);
}
.fm-menu-item em {
  margin-left: auto;
  padding-left: 26px;
  font-style: normal;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.fm-menu-item .fm-tail {
  display: inline-flex;
  margin-left: auto;
  padding-left: 20px;
}
.fm-menu-sep {
  height: 1px;
  margin: 5px 2px;
  background: var(--el-border-color-lighter);
}
</style>
