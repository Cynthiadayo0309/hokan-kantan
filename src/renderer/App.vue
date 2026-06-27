<template>
  <v-app>
    <v-app-bar color="primary" flat height="64">
      <v-app-bar-title>
        <div class="app-title">訪看かんたん計算</div>
        <div class="app-subtitle">施設内訪問看護 月額費用シミュレーター</div>
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <div class="app-shell">
        <nav class="step-nav" aria-label="現在の操作位置">
          <div :class="['step-item', route.name === 'monthly-input' ? 'active' : '']">1. 月間予定を入力</div>
          <div :class="['step-item', route.name === 'cost-detail' ? 'active' : '']">2. 費用を確認</div>
        </nav>

        <v-alert class="mb-3" type="info" variant="tonal" density="comfortable">
          本計算結果は概算です。実際の算定・請求内容を保証するものではありません。
        </v-alert>
        <v-alert v-if="store.pricingVersion?.usesSamplePricing" class="mb-4" color="warning" icon="mdi-alert-circle-outline" variant="tonal" density="comfortable">
          現在はサンプル料金を使用しています。正式な費用計算には料金マスターの更新が必要です。
        </v-alert>

        <router-view />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { useEstimateStore } from "./stores/estimateStore";

const route = useRoute();
const store = useEstimateStore();
</script>
