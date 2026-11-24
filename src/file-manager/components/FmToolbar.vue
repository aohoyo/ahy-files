<script setup>
// 工具栏：后退、前进、上一级、刷新，地址栏的面包屑，搜索当前目录。
import FmIcon from "./FmIcon.vue";
import { useFm } from "../composables/context";

const fm = useFm();
</script>

<template>
  <div class="fm-bar fm-toolbar">
    <button class="fm-navbtn" :disabled="!fm.canBack" title="后退" @click="fm.back()"><FmIcon name="navBack" /></button>
    <button class="fm-navbtn" :disabled="!fm.canForward" title="前进" @click="fm.forward()"><FmIcon name="navForward" /></button>
    <button class="fm-navbtn" :disabled="!fm.canUp" title="上一级" @click="fm.up()"><FmIcon name="navUp" /></button>
    <button class="fm-navbtn" :class="{ spin: fm.spinning }" title="刷新" @click="fm.refresh()"><FmIcon name="refresh" /></button>

    <div class="fm-addr">
      <FmIcon name="hardDrive" />
      <template v-for="(c, i) in fm.crumbs" :key="c.path">
        <span v-if="i" class="fm-sep">›</span>
        <button class="fm-crumb" :class="{ cur: i === fm.crumbs.length - 1 }" :title="c.path || '根目录'" @click="fm.go(c.path)">
          {{ c.name }}
        </button>
      </template>
      <span v-if="!fm.writable" class="fm-ro" title="这个目录只能浏览，不能改动"><FmIcon name="lockClosed" />只读</span>
    </div>

    <label class="fm-search">
      <FmIcon name="search" />
      <input v-model="fm.query" placeholder="搜索当前目录" spellcheck="false" @keydown.esc.stop="fm.query = ''" />
    </label>
  </div>
</template>
