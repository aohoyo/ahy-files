<script setup>
// 演示页外壳：尺寸和配色照后台截图搭的示意框（深色侧栏 256、顶栏 64、标签栏 50），
// 左侧菜单只是布景，不属于文件管理器。右上角的开关用来演示「没有权限时命令置灰」。
import { computed, ref } from "vue";
import { FileManager } from "@aohoyo/ahy-web";
import { paths } from "../src/file-manager/icons/fluent.js";
import { createFakeApi } from "./fakeApi.js";

const api = createFakeApi();
const readOnly = ref(false);
const can = computed(() => (action) => !(readOnly.value && action !== "download"));

const MENU = [
  ["shellHome", "首页", 0],
  ["shellPerson", "用户管理", 0],
  ["shellShop", "代理管理", 1],
  [null, "代理列表", 2],
  [null, "代理流水", 2],
  [null, "商户管理", 0],
  ["shellCloud", "应用发布", 1],
  [null, "云端变量", 2],
  [null, "版本发布", 2],
  [null, "文件管理", 2, 1],
  ["shellChat", "微信适配", 0],
  ["shellCloud", "资源发布", 0],
  ["shellSettings", "系统管理", 0],
];
</script>

<template>
  <aside class="sidebar">
    <div class="brand"><span class="logo">a</span>演示后台</div>
    <div class="nav">
      <template v-for="(m, i) in MENU" :key="i">
        <div v-if="m[2] === 2" class="mi sub" :class="{ active: m[3] }">{{ m[1] }}</div>
        <div v-else class="mi" :class="{ group: m[2] === 1 }">
          <span v-if="m[0]" class="ico" v-html="`<svg viewBox='0 0 24 24' fill='currentColor'><path d='${paths[m[0]]}'/></svg>`"></span>
          {{ m[1] }}
          <span v-if="m[2] === 1" class="caret">
            <span class="ico" v-html="`<svg viewBox='0 0 24 24' fill='currentColor'><path d='${paths.chevronUp}'/></svg>`"></span>
          </span>
        </div>
      </template>
    </div>
  </aside>
  <div class="main">
    <div class="topbar">
      <span class="avatar"></span>
      <div class="who"><span>admin</span><i></i></div>
    </div>
    <div class="tabs">
      <div class="tab">首页</div>
      <div class="tab active">文件管理</div>
    </div>
    <div class="content">
      <div class="card">
        <div class="card-head">
          <h1>文件管理</h1>
          <span class="draft">演示页 · 假数据</span>
          <label class="toggle"><input v-model="readOnly" type="checkbox" />只读账号</label>
        </div>
        <!-- 演示页的假适配器不下发可写根，这里显式传（和真后端下发的是同一份口径） -->
        <FileManager :api="api" :can="can" :writableRoots="['files/']" />
      </div>
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
}
#app {
  display: flex;
  overflow: hidden;
  font:
    14px/1.5 "Microsoft YaHei UI",
    "Microsoft YaHei",
    "PingFang SC",
    sans-serif;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}
.sidebar {
  width: 256px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #21252b;
  color: #a3a6ad;
}
.brand {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}
.brand .logo {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}
.nav {
  padding: 6px 0;
}
.mi {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 0 20px;
}
.mi.sub {
  padding-left: 44px;
}
.mi.active {
  background: var(--el-color-primary);
  color: #fff;
}
.ico {
  display: inline-flex;
}
.ico svg {
  width: 18px;
  height: 18px;
}
.caret {
  margin-left: auto;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 16px;
  background: var(--el-bg-color);
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);
  position: relative;
  z-index: 5;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.who i {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}
.tabs {
  height: 50px;
  display: flex;
  align-items: flex-end;
  padding: 0 16px;
  gap: 6px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.tab {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.tab.active {
  background: var(--el-color-primary);
  color: #fff;
}
.content {
  flex: 1;
  min-height: 0;
  padding: 20px;
  display: flex;
}
.card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 21, 41, 0.05);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.card-head h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.draft {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 0 9px;
  line-height: 19px;
}
.toggle {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
</style>
