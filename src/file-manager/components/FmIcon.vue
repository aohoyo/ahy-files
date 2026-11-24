<script setup>
// 一个 Fluent 图标。大小由外层样式定，颜色跟随文字颜色。
import { iconSvg } from "../icons";

defineProps({ name: { type: String, required: true } });
</script>

<template>
  <span class="fm-ico" v-html="iconSvg(name)" />
</template>
