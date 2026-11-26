<script setup>
// 条目的名字。改名走弹窗（FmRenameDialog）：图标视图里就地输入会被格子裁掉，名字长了看不全。
defineProps({ entry: { type: Object, required: true } });
</script>

<template>
  <span class="fm-lbl" :title="entry.name">{{ entry.name }}</span>
</template>
