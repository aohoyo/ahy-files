<script setup>
// 文件管理器整页：工具栏、命令栏、左侧目录树、文件区、状态栏，加上传进度、右键菜单和几个对话框。
// 它只认适配器（api），不直接调任何后端接口；状态都在这一个组件里，子组件经 provide/inject 取用。
import { provide, ref } from "vue";
import "./styles.css";
import { useFileManager } from "./composables/useFileManager";
import { FM_KEY } from "./composables/context";
import FmToolbar from "./components/FmToolbar.vue";
import FmCommandBar from "./components/FmCommandBar.vue";
import FmSideTree from "./components/FmSideTree.vue";
import FmView from "./components/FmView.vue";
import FmStatusBar from "./components/FmStatusBar.vue";
import FmContextMenu from "./components/FmContextMenu.vue";
import FmUploadPanel from "./components/FmUploadPanel.vue";
import FmDeleteDialog from "./components/FmDeleteDialog.vue";
import FmMoveDialog from "./components/FmMoveDialog.vue";
import FmImageViewer from "./components/FmImageViewer.vue";

defineOptions({ name: "FileManager" });

const props = defineProps({
  // 适配器，必填。方法清单见 api.js
  api: { type: Object, required: true },
  // 哪些目录能写（含子目录），其余目录只读浏览
  writableRoots: { type: Array, default: () => ["files/"] },
  // 权限回调 can(action)，action 是 upload / create / rename / move / copy / delete / download 之一；不传就都行
  can: { type: Function, default: null },
  // 允许的后缀（如 [".zip", ".exe"]）和单文件上限（字节）；不传按后端随列目录带回的来
  accept: { type: Array, default: null },
  maxSize: { type: Number, default: null },
});

const root = ref(null);
const fm = useFileManager(props);
provide(FM_KEY, fm);

// 点进文件管理器就把焦点挪到它身上，快捷键才有人接；不抢输入框的焦点
function takeFocus() {
  if (root.value && !root.value.contains(document.activeElement)) root.value.focus({ preventScroll: true });
}
</script>

<template>
  <div
    ref="root"
    class="fm"
    :class="{ dropping: fm.dropping }"
    tabindex="-1"
    @keydown="fm.onKeydown"
    @mousedown="takeFocus"
    @dragenter="fm.onDragEnter"
    @dragover="fm.onDragOver"
    @dragleave="fm.onDragLeave"
    @drop="fm.onDrop"
  >
    <FmToolbar />
    <FmCommandBar />
    <div class="fm-body">
      <FmSideTree />
      <FmView />
    </div>
    <FmStatusBar />

    <div class="fm-dropzone">松开鼠标，上传到这个目录</div>
    <div v-if="fm.busy" class="fm-busy"><div><span class="fm-spin" />{{ fm.busy }}</div></div>

    <FmUploadPanel />
    <FmContextMenu />
    <FmDeleteDialog />
    <FmMoveDialog />
    <FmImageViewer />

    <input :ref="(el) => (fm.fileInput = el)" type="file" multiple hidden @change="fm.onPicked" />
    <input :ref="(el) => (fm.folderInput = el)" type="file" webkitdirectory multiple hidden @change="fm.onPicked" />
  </div>
</template>
