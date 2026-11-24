<script setup>
// 上传进度浮层：贴在右下角，每个文件一行进度，可以收起、取消；全部结束后留着结果等使用者关掉。
import { computed } from "vue";
import FmIcon from "./FmIcon.vue";
import FmFileIcon from "./FmFileIcon.vue";
import { fmtSize } from "../logic/format";
import { useFm } from "../composables/context";

const fm = useFm();
const s = fm.uploads.summary;
const tasks = fm.uploads.tasks;

// 这一批是否都已经有了结果（传完、失败或取消）
const settled = computed(() => !s.value.working && tasks.value.length > 0);
const percent = (t) => (t.size ? Math.round((t.loaded / t.size) * 100) : 100);
const nameOf = (t) => t.rel.split("/").pop();

function toggle() {
  if (settled.value) fm.uploads.close();
  else fm.uploads.panel.small = !fm.uploads.panel.small;
}
</script>

<template>
  <div v-if="fm.uploads.panel.open && tasks.length" class="fm-xf" :class="{ small: fm.uploads.panel.small }">
    <div class="fm-xf-h">
      <span>{{ s.working ? `正在上传 ${s.next}/${s.total}` : s.failed ? `上传完成，${s.failed} 个失败` : "上传完成" }}</span>
      <span v-if="s.working" class="fm-pct">{{ s.percent }}%</span>
      <span class="fm-push" />
      <button class="fm-iconbtn" :title="settled ? '关闭' : '收起'" @click="toggle">
        <FmIcon :name="settled ? 'close' : 'chevronDown'" />
      </button>
      <button v-if="s.working" class="fm-iconbtn" title="取消上传" @click="fm.uploads.cancel()"><FmIcon name="close" /></button>
    </div>
    <div class="fm-xf-body">
      <div v-for="t in tasks" :key="t.id" class="fm-xf-row">
        <FmIcon v-if="t.status === 'done'" name="check" />
        <FmFileIcon v-else :entry="{ key: t.key, name: nameOf(t), dir: false }" :size="20" :thumb="false" />
        <div class="fm-meta">
          <div :title="t.rel">{{ t.rel }}</div>
          <div v-if="t.status === 'done'"><span>已完成 · {{ fmtSize(t.size) }}</span></div>
          <div v-else-if="t.status === 'wait'"><span>等待中</span></div>
          <div v-else-if="t.status === 'error'" class="fm-err" :title="t.error">{{ t.error }}</div>
          <div v-else-if="t.status === 'canceled'" class="fm-err">已取消</div>
          <div v-else>
            <div class="fm-progress"><i :style="{ width: percent(t) + '%' }" /></div>
            <span>{{ fmtSize(t.loaded) }} / {{ fmtSize(t.size) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
