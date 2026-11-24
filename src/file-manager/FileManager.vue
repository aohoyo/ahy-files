<script setup>
// 骨架阶段的占位实现：只证明适配器接得通（能进目录、能列文件），正式界面在后续几批里替换。
import { onMounted, ref } from "vue";
import { crumbs } from "./logic/path";

const props = defineProps({
  api: { type: Object, required: true },
});

const prefix = ref("");
const entries = ref([]);

async function load(p) {
  const r = await props.api.list({ prefix: p });
  prefix.value = r.prefix;
  entries.value = r.entries;
}

onMounted(() => load(""));
</script>

<template>
  <div class="fm-skeleton">
    <nav class="crumbs">
      <button v-for="c in crumbs(prefix)" :key="c.path" type="button" @click="load(c.path)">{{ c.name }}</button>
    </nav>
    <ul>
      <li v-for="e in entries" :key="e.key">
        <button v-if="e.dir" type="button" @click="load(e.key)">{{ e.name }}/</button>
        <span v-else>{{ e.name }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.fm-skeleton {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
}
.crumbs {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
