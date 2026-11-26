<script setup>
// 图片预览：用 element-plus 的 ElImageViewer（自带缩放、旋转、左右切换、滚轮放大、点遮罩关闭），
// 不再自研一套只有上一张/下一张的弹窗（2026-11-26 创始人问「大图点开用的是什么」后换掉）。
// 地址优先取 1280 的中图（快），取不到退回原图；整目录都没有可用地址就不进 viewer。
import { computed, ref, watch } from "vue";
import { ElImageViewer } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/image-viewer/style/css";
import { useFm } from "../composables/context";

// 预览取图的宽度
const PREVIEW_WIDTH = 1280;

const fm = useFm();
const list = computed(() => fm.viewerImages);
// 每一项 { key, url }：key 用来对上当前打开的是哪张
const items = ref([]);
let seq = 0;

// 打开（或换了目录再打开）时把整个目录的图片地址算一遍：ElImageViewer 要一次拿到全部地址才能左右翻
watch(
  () => fm.viewer?.key,
  async (key) => {
    if (!key) {
      items.value = [];
      return;
    }
    const mine = ++seq;
    const snapshot = list.value.slice();
    const out = await Promise.all(
      snapshot.map(async (e) => {
        try {
          const u = await fm.api.thumbUrl({ key: e.key, width: PREVIEW_WIDTH });
          if (typeof u === "string" && u) return { key: e.key, url: u };
        } catch {
          // 中图取不到：换原图再试
        }
        try {
          const u = await (fm.api.linkUrl ? fm.api.linkUrl({ key: e.key }) : fm.api.downloadUrl({ key: e.key }));
          return { key: e.key, url: typeof u === "string" ? u : "" };
        } catch {
          return { key: e.key, url: "" };
        }
      }),
    );
    if (mine !== seq) return;
    items.value = out.filter((it) => it.url);
  },
  { immediate: true },
);

// 当前这张在可用地址里的下标；当前这张没取到地址就退回第一张，别让 viewer 打不开
const startIndex = computed(() => {
  const i = items.value.findIndex((it) => it.key === fm.viewer?.key);
  return i >= 0 ? i : 0;
});
const open = computed(() => !!fm.viewer && items.value.length > 0);
const close = () => (fm.viewer = null);
</script>

<template>
  <ElImageViewer
    v-if="open"
    :url-list="items.map((it) => it.url)"
    :initial-index="startIndex"
    teleported
    hide-on-click-modal
    @close="close"
  />
</template>
