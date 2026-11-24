<script setup>
// 图片预览：看当前目录里的图片，左右切换，另给一张原图的下载。
// 图片地址和缩略图走同一个口子（适配器的 thumbUrl），只是取得宽一些；
// 中图出不来（原图超过对象存储的处理上限）就退到原图，原图也不行才提示一句。
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElDialog } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/dialog/style/css";
import FmIcon from "./FmIcon.vue";
import { fmtSize, fmtTime } from "../logic/format";
import { useFm } from "../composables/context";

// 预览取图的宽度
const PREVIEW_WIDTH = 1280;

const fm = useFm();
const list = computed(() => fm.viewerImages);
const index = computed(() => list.value.findIndex((e) => e.key === fm.viewer?.key));
const entry = computed(() => list.value[index.value] || null);
// stage：thumb 先看中图；original 中图出不来再看原图；dead 都不行
const src = ref("");
const stage = ref("thumb");
const close = () => (fm.viewer = null);

// 连着按方向键切换时，慢的那一份回来得晚，不能盖掉当前这张：每次加载带一个序号
let seq = 0;
async function load(next) {
  const mine = ++seq;
  const e = entry.value;
  if (!e) return;
  try {
    const url =
      next === "thumb"
        ? await fm.api.thumbUrl({ key: e.key, width: PREVIEW_WIDTH })
        : await (fm.api.linkUrl ? fm.api.linkUrl({ key: e.key }) : fm.api.downloadUrl({ key: e.key }));
    if (mine !== seq) return;
    src.value = typeof url === "string" ? url : "";
    if (src.value) stage.value = next;
    else if (next === "thumb") load("original");
    else stage.value = "dead";
  } catch {
    if (mine !== seq) return;
    if (next === "thumb") load("original");
    else stage.value = "dead";
  }
}

watch(entry, (e) => {
  src.value = "";
  if (e) load("thumb");
  else stage.value = "thumb";
});

function onImgError() {
  if (stage.value === "thumb") load("original");
  else stage.value = "dead";
}

const step = (d) => {
  const n = index.value + d;
  if (n >= 0 && n < list.value.length) fm.viewer = { key: list.value[n].key };
};

async function original() {
  try {
    window.open(await fm.api.downloadUrl({ key: entry.value.key }), "_blank", "noopener");
  } catch (e) {
    fm.toast(e?.message || "下载失败", "error");
  }
}

// 预览框传送到 body 下，不在文件管理器里，方向键要自己听
function onKey(ev) {
  if (!fm.viewer || ev.target instanceof HTMLInputElement) return;
  if (ev.key === "ArrowLeft") step(-1);
  else if (ev.key === "ArrowRight") step(1);
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <ElDialog
    :model-value="index >= 0"
    class="fm-viewer"
    append-to-body
    :show-close="false"
    @update:model-value="(v) => !v && close()"
  >
    <button class="fm-vbtn l" :disabled="index <= 0" title="上一张" @click="step(-1)"><FmIcon name="chevronLeft" /></button>
    <button class="fm-vbtn r" :disabled="index >= list.length - 1" title="下一张" @click="step(1)"><FmIcon name="chevronRight" /></button>

    <img v-if="stage !== 'dead' && src" :src="src" alt="" @error="onImgError" />
    <div v-else-if="stage === 'dead'" class="fm-vempty">图片没能加载出来</div>

    <div class="fm-cap">
      <span>{{ entry?.name }}</span>
      <span class="fm-meta">
        {{ entry ? `${fmtSize(entry.size)} · ${fmtTime(entry.mtime)} · ${index + 1} / ${list.length}` : "" }}
      </span>
      <span class="fm-push" />
      <button class="fm-btn sm" :disabled="!entry" @click="original">下载原图</button>
      <button class="fm-iconbtn" title="关闭" @click="close"><FmIcon name="close" /></button>
    </div>
  </ElDialog>
</template>
