<script setup>
// 文件的图标：图片直接显示缩略图，其余按类型显示 Fluent 图标。
// 缩略图由对象存储实时生成，按显示宽度的两倍取图，高分屏才清晰；取不到就退回图片图标，不影响别的条目。
// 用 el-image 而不是裸 img：懒加载、加载占位、失败兜底都是现成的（2026-11-26 创始人定）。
import { computed, ref, watch } from "vue";
import { ElImage } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/image/style/css";
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

const icon = computed(() => iconSvg(type.value.icon));
const showThumb = computed(() => type.value.image && !!src.value && !failed.value);
const box = computed(() => ({ width: props.size + "px", height: props.size + "px" }));
</script>

<template>
  <span class="fm-ficon" :style="{ ...box, color: type.color }">
    <ElImage
      v-if="showThumb"
      :src="src"
      fit="cover"
      lazy
      :style="box"
      @error="failed = true"
    />
    <span v-else class="fm-ficon-svg" v-html="icon" />
  </span>
</template>

<style scoped>
/* el-image 内部结构与内部 img 要撑满并保留圆角：Element 渲染的节点不带本组件的
   scoped 属性，用 :deep 穿透——这属于「给自有组件的实例定布局」，不是改它的皮肤。
   图标盒的基础样式（.fm-ficon / .fm-ficon svg）在全局 styles.css：左侧树与选目标
   弹窗里还有裸用这个类的地方 */
.fm-ficon > :deep(.el-image),
.fm-ficon :deep(.el-image img) {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 3px;
  object-fit: cover;
  background: var(--el-fill-color-light);
}
</style>
