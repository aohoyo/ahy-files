<script setup>
// 文件区：按当前视图画出条目，并统一处理点选、框选、双击、右键。
// 各视图只负责画（条目带 data-key），事件都委托到这一层，六种视图就不用各写一遍。
import { onBeforeUnmount, ref, watch } from "vue";
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
        <button class="fm-btn sm" @click="fm.refresh()">重试</button>
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
