<script setup>
// 文件区：按当前视图画出条目，并统一处理点选、框选、双击、右键。
// 各视图只负责画（条目带 data-key），事件都委托到这一层，六种视图就不用各写一遍。
import { onBeforeUnmount, ref, watch } from "vue";
import { ElButton } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/button/style/css";
import FmIcon from "./FmIcon.vue";
import FmFileIcon from "./FmFileIcon.vue";
import FmLabel from "./FmLabel.vue";
import { iconSvg } from "../icons";
import { fmtSize, fmtTime } from "../logic/format";
import { useFm } from "../composables/context";

const fm = useFm();
// 大图标、中图标、小图标各自的图标尺寸
const GRID_SIZE = { lg: 96, md: 64, sm: 28 };
const COLUMN_CLASS = { mtime: "c3", type: "c4", size: "c5" };

const el = ref(null);
// 框选的方框（相对滚动内容定位）和起点
const box = ref(null);
let drag = null;
let raf = 0;

// 就地改名提交后把焦点交还给文件区（输入框没了，焦点会落回 body）
fm.setViewFocus(() => el.value?.focus({ preventScroll: true }));

watch(
  () => fm.path,
  () => el.value && (el.value.scrollTop = 0),
);

const keyOf = (ev) => ev.target.closest("[data-key]")?.dataset.key || "";
const entryOf = (key) => fm.visible.find((e) => e.key === key);

function onMousedown(ev) {
  if (ev.button !== 0) return;
  fm.closeMenu();
  const key = keyOf(ev);
  if (key && ev.target.closest(".fm-cbx")) {
    // 点在勾选框上：只切换这一项，不改变其他已选的
    ev.preventDefault();
    fm.toggle(key);
    return;
  }
  if (ev.target.closest("[data-all]")) {
    ev.preventDefault();
    if (fm.allSelected) fm.clearSelection();
    else fm.selectAll();
    return;
  }
  if (key) {
    // 已经选中的那一项，不带 Ctrl、Shift 时先不动选择（和资源管理器一样，方便接着双击或整批操作）
    if (!fm.isSelected(key) || ev.ctrlKey || ev.metaKey || ev.shiftKey) fm.pick(key, ev);
    return;
  }
  if (ev.target.closest("thead, input, button")) return;
  // 空白处：清掉选择，并从这里开始框选
  fm.clearSelection();
  startMarquee(ev);
}

function onDblclick(ev) {
  const key = keyOf(ev);
  if (key && !ev.target.closest(".fm-cbx, input")) fm.open(entryOf(key));
}

function onContextmenu(ev) {
  const key = keyOf(ev);
  const entry = key ? entryOf(key) : null;
  if (entry) fm.entryMenu(entry, ev);
  else if (!ev.target.closest("input")) fm.blankMenu(ev);
}

function onClick(ev) {
  const th = ev.target.closest("[data-sort]");
  if (th) fm.setSort(th.dataset.sort);
}

// ---- 框选：从空白处按下拖着走，方框碰到的条目都选中；按着 Ctrl 是在原选择上加 ----
const point = (ev) => {
  const r = el.value.getBoundingClientRect();
  return { x: ev.clientX - r.left + el.value.scrollLeft, y: ev.clientY - r.top + el.value.scrollTop };
};

function startMarquee(ev) {
  const p = point(ev);
  drag = { x0: p.x, y0: p.y, additive: ev.ctrlKey || ev.metaKey, base: fm.selected.map((e) => e.key) };
  box.value = { x: p.x, y: p.y, w: 0, h: 0 };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function onMove(ev) {
  if (!drag) return;
  const p = point(ev);
  box.value = { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) };
  if (!raf) raf = requestAnimationFrame(hitTest);
}

function hitTest() {
  raf = 0;
  if (!drag || !box.value || !el.value) return;
  const b = box.value;
  const r = el.value.getBoundingClientRect();
  const hits = [];
  for (const node of el.value.querySelectorAll("[data-key]")) {
    const n = node.getBoundingClientRect();
    const x = n.left - r.left + el.value.scrollLeft;
    const y = n.top - r.top + el.value.scrollTop;
    if (x < b.x + b.w && x + n.width > b.x && y < b.y + b.h && y + n.height > b.y) hits.push(node.dataset.key);
  }
  fm.setSelection(drag.additive ? [...new Set([...drag.base, ...hits])] : hits);
}

function onUp() {
  // 松手前最后一下移动排的检查还没跑（它要等下一帧），这里先把它作废、当场算完，
  // 否则框到哪里只算到倒数第二个位置
  cancelAnimationFrame(raf);
  raf = 0;
  hitTest();
  drag = null;
  box.value = null;
  window.removeEventListener("mousemove", onMove);
  window.removeEventListener("mouseup", onUp);
}
onBeforeUnmount(onUp);
</script>

<template>
  <div
    ref="el"
    class="fm-view"
    tabindex="0"
    @mousedown="onMousedown"
    @dblclick="onDblclick"
    @contextmenu.prevent="onContextmenu"
    @click="onClick"
  >
    <!-- 详细信息 -->
    <table v-if="fm.view === 'details'" class="fm-list">
      <thead>
        <tr>
          <th class="c1">
            <span class="fm-cbx" :class="{ on: fm.allSelected, part: fm.someSelected }" data-all><FmIcon name="check" /></span>
          </th>
          <th
            v-for="c in fm.sorts"
            :key="c.key"
            class="sortable"
            :class="[COLUMN_CLASS[c.key], { num: c.key === 'size' }]"
            :data-sort="c.key"
          >
            {{ c.label }}<span v-if="fm.sort.key === c.key" class="fm-arr">{{ fm.sort.dir > 0 ? "▲" : "▼" }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="e in fm.visible"
          :key="e.key"
          :data-key="e.key"
          :class="{ sel: fm.isSelected(e.key), cut: fm.isCut(e.key) }"
        >
          <td class="c1"><span class="fm-cbx" :class="{ on: fm.isSelected(e.key) }"><FmIcon name="check" /></span></td>
          <td><div class="fm-nmcell"><FmFileIcon :entry="e" :size="20" /><FmLabel :entry="e" /></div></td>
          <td class="c3">{{ e.dir ? "" : fmtTime(e.mtime) }}</td>
          <td class="c4">{{ fm.typeOf(e).label }}</td>
          <td class="c5 num">{{ e.dir ? "" : fmtSize(e.size) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- 列表 -->
    <div v-else-if="fm.view === 'list'" class="fm-flow">
      <div
        v-for="e in fm.visible"
        :key="e.key"
        class="fm-lrow"
        :data-key="e.key"
        :class="{ sel: fm.isSelected(e.key), cut: fm.isCut(e.key) }"
      >
        <span class="fm-cbx" :class="{ on: fm.isSelected(e.key) }"><FmIcon name="check" /></span>
        <FmFileIcon :entry="e" :size="20" /><FmLabel :entry="e" />
      </div>
    </div>

    <!-- 平铺 -->
    <div v-else-if="fm.view === 'tiles'" class="fm-tiles">
      <div
        v-for="e in fm.visible"
        :key="e.key"
        class="fm-ptile"
        :data-key="e.key"
        :class="{ sel: fm.isSelected(e.key), cut: fm.isCut(e.key) }"
      >
        <span class="fm-cbx" :class="{ on: fm.isSelected(e.key) }"><FmIcon name="check" /></span>
        <FmFileIcon :entry="e" :size="48" />
        <div class="fm-txt">
          <FmLabel :entry="e" />
          <div class="fm-sub">{{ e.dir ? "文件夹" : `${fm.typeOf(e).label} · ${fmtSize(e.size)}` }}</div>
        </div>
      </div>
    </div>

    <!-- 大图标 / 中图标 / 小图标 -->
    <div v-else class="fm-grid" :class="fm.view">
      <div
        v-for="e in fm.visible"
        :key="e.key"
        class="fm-tile"
        :data-key="e.key"
        :class="{ sel: fm.isSelected(e.key), cut: fm.isCut(e.key) }"
      >
        <span class="fm-cbx" :class="{ on: fm.isSelected(e.key) }"><FmIcon name="check" /></span>
        <FmFileIcon :entry="e" :size="GRID_SIZE[fm.view]" />
        <FmLabel :entry="e" />
      </div>
    </div>

    <!-- 空态、读取出错 -->
    <div v-if="!fm.visible.length && !fm.loading" class="fm-empty">
      <template v-if="fm.error">
        <div>这个目录没能列出来</div>
        <div style="margin-top: 4px">{{ fm.error }}</div>
        <ElButton size="small" @click="fm.refresh()">重试</ElButton>
      </template>
      <template v-else>
        <span class="fm-ficon" style="width: 56px; height: 56px; color: #f0b13b" v-html="iconSvg('folderOpenFill')" />
        <div>{{ fm.query.trim() ? "没有匹配的文件" : "此文件夹为空" }}</div>
      </template>
    </div>

    <div v-if="fm.loading || fm.loadingMore" class="fm-loading"><span class="fm-spin" />{{ fm.loadingMore ? "正在加载…" : "正在读取…" }}</div>

    <div
      v-if="box"
      class="fm-marquee"
      :style="{ display: 'block', left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }"
    />
  </div>
</template>

<style scoped>
/* ---------- 文件区 ---------- */
.fm-view {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: var(--el-bg-color);
  outline: none;
  user-select: none;
}
.fm-view.dropping {
  outline: 2px dashed var(--el-color-primary);
  outline-offset: -8px;
}
.fm-loading {
  position: absolute;
  top: 10px;
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 14px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
  color: var(--el-text-color-regular);
  font-size: 12.5px;
}
.fm-empty {
  padding: 70px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.fm-empty .fm-ficon {
  width: 56px;
  height: 56px;
  display: block;
  margin: 0 auto 12px;
}
.fm-empty .el-button {
  margin-top: 12px;
}

/* 勾选框 */
.fm-cbx {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--el-border-color);
  border-radius: 3px;
  background: var(--el-bg-color);
  color: #fff;
  cursor: pointer;
}
.fm-cbx svg {
  width: 12px;
  height: 12px;
  opacity: 0;
}
.fm-cbx.on {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.fm-cbx.on svg {
  opacity: 1;
}
.fm-cbx.part::after {
  content: "";
  width: 8px;
  height: 2px;
  border-radius: 1px;
  background: var(--el-color-primary);
}

/* 详细信息：表格 */
.fm-list {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.fm-list th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 34px;
  padding: 0 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 12.5px;
  font-weight: 400;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.fm-list th.sortable {
  cursor: pointer;
}
.fm-list th.sortable:hover {
  background: var(--el-fill-color-light);
}
.fm-list th .fm-arr {
  margin-left: 2px;
  color: var(--el-color-primary);
  font-size: 9px;
}
.fm-list td {
  height: 37px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 13.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
}
.fm-list td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.fm-list tbody tr:hover {
  background: var(--el-fill-color-light);
}
.fm-list tbody tr.sel td {
  background: var(--el-color-primary-light-9);
  border-top-color: var(--el-color-primary-light-5);
  border-bottom-color: var(--el-color-primary-light-5);
}
.fm-list tbody tr.sel td:first-child {
  border-left: 1px solid var(--el-color-primary-light-5);
  border-radius: 4px 0 0 4px;
}
.fm-list tbody tr.sel td:last-child {
  border-right: 1px solid var(--el-color-primary-light-5);
  border-radius: 0 4px 4px 0;
}
.fm-list tbody tr.sel + tr.sel td {
  border-top-color: transparent;
}
.fm-list tbody tr.sel + tr.sel td:first-child {
  border-top-left-radius: 0;
}
.fm-list tbody tr.sel + tr.sel td:last-child {
  border-top-right-radius: 0;
}
.fm-list tbody tr.sel:has(+ tr.sel) td:first-child {
  border-bottom-left-radius: 0;
}
.fm-list tbody tr.sel:has(+ tr.sel) td:last-child {
  border-bottom-right-radius: 0;
}
.fm-list .c1 {
  width: 38px;
  padding-right: 0;
}
.fm-list .c3 {
  width: 156px;
}
.fm-list .c4 {
  width: 120px;
}
.fm-list .c5 {
  width: 104px;
}
.fm-nmcell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.fm-lbl {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 剪切掉的条目变淡 */
.fm-cut .fm-ficon {
  opacity: 0.45;
}
.fm-cut .fm-lbl {
  color: var(--el-text-color-secondary);
}

/* 大图标 / 中图标 / 小图标 */
.fm-grid {
  display: grid;
  gap: 4px;
  padding: 12px;
  align-content: start;
}
.fm-grid.lg {
  grid-template-columns: repeat(auto-fill, minmax(146px, 1fr));
}
.fm-grid.md {
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
}
.fm-grid.sm {
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
}
.fm-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 14px 8px 10px;
  border: 1px solid transparent;
  border-radius: 5px;
  text-align: center;
}
.fm-grid.sm .fm-tile {
  flex-direction: row;
  justify-content: flex-start;
  gap: 8px;
  padding: 7px 8px;
  text-align: left;
}
.fm-tile:hover {
  background: var(--el-fill-color-light);
}
.fm-tile.sel {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}
.fm-tile > .fm-ficon {
  width: 64px;
  height: 64px;
}
.fm-grid.lg .fm-tile > .fm-ficon {
  width: 96px;
  height: 96px;
}
.fm-grid.sm .fm-tile > .fm-ficon {
  width: 28px;
  height: 28px;
}
.fm-tile .fm-lbl {
  font-size: 12.5px;
  line-height: 1.35;
  word-break: keep-all;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fm-grid.lg .fm-tile .fm-lbl {
  -webkit-line-clamp: 3;
}
.fm-grid.sm .fm-tile .fm-lbl {
  -webkit-line-clamp: 1;
}
.fm-tile > .fm-cbx {
  position: absolute;
  top: 5px;
  left: 5px;
  opacity: 0;
}
.fm-tile:hover > .fm-cbx,
.fm-tile.sel > .fm-cbx {
  opacity: 1;
}
.fm-grid.sm .fm-tile > .fm-cbx {
  position: static;
  opacity: 1;
}

/* 列表：一行一个，通栏竖排（和详细信息同构，只是不列表头）；
 * 小图标才是多栏网格，两者不能长一个样（2026-11-26 创始人指出） */
.fm-flow {
  padding: 8px 12px;
}
.fm-lrow {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border-radius: 4px;
}
.fm-lrow:hover {
  background: var(--el-fill-color-light);
}
.fm-lrow.sel {
  background: var(--el-color-primary-light-9);
  box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}
.fm-lrow .fm-lbl {
  font-size: 13.5px;
  white-space: nowrap;
}

/* 平铺：图标在左，名称和类型大小在右 */
.fm-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(252px, 1fr));
  gap: 4px;
  padding: 12px;
}
.fm-ptile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  padding: 10px 12px 10px 34px;
  border: 1px solid transparent;
  border-radius: 5px;
}
.fm-ptile:hover {
  background: var(--el-fill-color-light);
}
.fm-ptile.sel {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}
.fm-ptile > .fm-cbx {
  position: absolute;
  top: 9px;
  left: 9px;
  opacity: 0;
}
.fm-ptile:hover > .fm-cbx,
.fm-ptile.sel > .fm-cbx {
  opacity: 1;
}
.fm-ptile > .fm-ficon {
  width: 48px;
  height: 48px;
}
.fm-ptile .fm-txt {
  min-width: 0;
}
.fm-ptile .fm-lbl {
  font-size: 13px;
  white-space: nowrap;
}
.fm-ptile .fm-sub {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
/* 框选 */
.fm-marquee {
  position: absolute;
  z-index: 2;
  display: none;
  border: 1px solid var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  opacity: 0.6;
  pointer-events: none;
}
</style>
