<script setup>
// 文件的图标：图片直接显示缩略图，其余按类型显示 Fluent 图标。
// 缩略图由对象存储实时生成，按显示宽度的两倍取图，高分屏才清晰；取不到就退回图片图标，不影响别的条目。
import { computed, ref, watch } from "vue";
import { iconSvg } from "../icons";
import { typeOf } from "../logic/sort";
import { useFm } from "../composables/context";

// 各显示宽度对应的取图宽度
const THUMB_WIDTH = { 20: 48, 28: 64, 48: 96, 64: 128, 96: 192 };

const props = defineProps({
  entry: { type: Object, required: true },
  size: { type: Number, default: 20 },
  // 为假时不出缩略图，只显示类型图标（上传进度里的文件还没传上去）
  thumb: { type: Boolean, default: true },
});
const fm = useFm();

const type = computed(() => typeOf(props.entry));
const src = ref("");
const failed = ref(false);

watch(
  () => [props.entry.key, props.size, props.thumb],
  async () => {
    failed.value = false;
    src.value = "";
    if (!props.thumb || !type.value.image) return;
    try {
      const url = await fm.api.thumbUrl({ key: props.entry.key, width: THUMB_WIDTH[props.size] || props.size * 2 });
      src.value = typeof url === "string" ? url : "";
    } catch {
      failed.value = true;
    }
  },
  { immediate: true },
);

const html = computed(() =>
  type.value.image && src.value && !failed.value
    ? `<img src="${src.value.replace(/"/g, "%22")}" alt="" loading="lazy" decoding="async">`
    : iconSvg(type.value.icon),
);
</script>

<template>
  <!-- 图片加载失败时把缩略图换成类型图标：error 事件不冒泡，所以在捕获阶段接 -->
  <span
    class="fm-ficon"
    :style="{ width: size + 'px', height: size + 'px', color: type.color }"
    v-html="html"
    @error.capture="failed = true"
  />
</template>
