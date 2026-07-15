<template>
  <v-app>
    <v-app-bar color="primary" flat height="64">
      <v-app-bar-title>
        <div class="app-title">訪看かんたん計算</div>
        <div class="app-subtitle">施設内訪問看護 月額費用シミュレーター</div>
      </v-app-bar-title>
      <div class="app-icon-actions">
        <v-chip v-if="insuranceLabel" color="white" variant="outlined" class="mr-2">{{ insuranceLabel }}</v-chip>
        <v-btn v-if="insuranceLabel" variant="text" color="white" prepend-icon="mdi-swap-horizontal" @click="router.push({ name: 'insurance-select' })">
          保険を選び直す
        </v-btn>
        <v-btn variant="text" color="white" prepend-icon="mdi-file-document-outline" @click="showLicenseNotice = true">
          利用条件
        </v-btn>
        <v-btn
          variant="text"
          color="white"
          prepend-icon="mdi-image-edit-outline"
          :loading="iconLoading === 'select'"
          title="使用権限のある画像を選んでください。"
          @click="selectCustomIcon"
        >
          アイコン変更
        </v-btn>
        <v-btn v-if="iconPreference?.hasCustomIcon" variant="text" color="white" prepend-icon="mdi-restore" :loading="iconLoading === 'reset'" @click="resetCustomIcon">
          標準に戻す
        </v-btn>
      </div>
    </v-app-bar>

    <v-main>
      <div class="app-shell">
        <nav v-if="insuranceLabel" class="step-nav" aria-label="現在の操作位置">
          <div :class="['step-item', isInputRoute ? 'active' : '']">1. 月間予定を入力</div>
          <div :class="['step-item', isDetailRoute ? 'active' : '']">2. 費用を確認</div>
        </nav>

        <v-alert v-if="insuranceLabel" class="mb-3" type="info" variant="tonal" density="comfortable">
          本計算結果は概算です。実際の算定・請求内容を保証するものではありません。
        </v-alert>
        <v-alert v-if="route.meta.insurance === 'medical' && store.pricingVersion?.usesSamplePricing" class="mb-4" color="warning" icon="mdi-alert-circle-outline" variant="tonal" density="comfortable">
          現在はサンプル料金を使用しています。正式な費用計算には料金マスターの更新が必要です。
        </v-alert>

        <router-view />
      </div>
    </v-main>
    <LicenseNoticeDialog v-model="showLicenseNotice" />
    <v-snackbar v-model="showIconMessage" color="primary" timeout="4500">{{ iconMessage }}</v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { IconPreference } from "../shared/types";
import LicenseNoticeDialog from "./components/LicenseNoticeDialog.vue";
import { useEstimateStore } from "./stores/estimateStore";

const route = useRoute();
const router = useRouter();
const store = useEstimateStore();
const iconPreference = ref<IconPreference | null>(null);
const iconLoading = ref<"" | "select" | "reset">("");
const iconMessage = ref("");
const showLicenseNotice = ref(false);
const insuranceLabel = computed(() => route.meta.insurance === "medical" ? "医療保険" : route.meta.insurance === "care" ? "介護保険" : "");
const isInputRoute = computed(() => route.name === "monthly-input" || route.name === "care-monthly-input");
const isDetailRoute = computed(() => route.name === "cost-detail" || route.name === "care-cost-detail");
const showIconMessage = computed({
  get: () => Boolean(iconMessage.value),
  set: (value: boolean) => {
    if (!value) iconMessage.value = "";
  }
});

onMounted(loadIconPreference);

async function loadIconPreference(): Promise<void> {
  try {
    iconPreference.value = await window.hokanApi.getIconPreference();
  } catch {
    iconPreference.value = null;
  }
}

async function selectCustomIcon(): Promise<void> {
  iconLoading.value = "select";
  try {
    const result = await window.hokanApi.selectCustomIcon();
    iconMessage.value = result.message;
    await loadIconPreference();
  } catch (error) {
    iconMessage.value = error instanceof Error ? error.message : "アイコン変更に失敗しました。";
  } finally {
    iconLoading.value = "";
  }
}

async function resetCustomIcon(): Promise<void> {
  iconLoading.value = "reset";
  try {
    const result = await window.hokanApi.resetCustomIcon();
    iconMessage.value = result.message;
    await loadIconPreference();
  } catch (error) {
    iconMessage.value = error instanceof Error ? error.message : "アイコンを戻せませんでした。";
  } finally {
    iconLoading.value = "";
  }
}
</script>
