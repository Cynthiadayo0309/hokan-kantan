<template>
  <section class="insurance-select">
    <div class="text-center mb-8">
      <v-icon color="primary" size="64">mdi-home-heart</v-icon>
      <h1 class="text-h4 font-weight-bold mt-3">どちらの保険で計算しますか？</h1>
      <p class="text-body-1 text-medium-emphasis mt-3">保険証や介護保険被保険者証を確認して選んでください。</p>
    </div>
    <div class="insurance-cards">
      <v-card class="insurance-card medical-card" variant="outlined" tabindex="0" @click="router.push({ name: 'monthly-input' })" @keydown.enter="router.push({ name: 'monthly-input' })">
        <v-card-text class="pa-8 text-center">
          <v-icon color="blue-darken-2" size="70">mdi-hospital-box-outline</v-icon>
          <h2 class="text-h5 font-weight-bold mt-4">医療保険</h2>
          <p class="text-body-1 mt-3">医療保険の訪問看護療養費を計算します。</p>
          <v-btn color="blue-darken-2" size="x-large" block class="mt-6">医療保険を選ぶ</v-btn>
        </v-card-text>
      </v-card>
      <v-card class="insurance-card care-card" variant="outlined" tabindex="0" @click="router.push({ name: 'care-monthly-input' })" @keydown.enter="router.push({ name: 'care-monthly-input' })">
        <v-card-text class="pa-8 text-center">
          <v-icon color="green-darken-2" size="70">mdi-hand-heart-outline</v-icon>
          <h2 class="text-h5 font-weight-bold mt-4">介護保険</h2>
          <p class="text-body-1 mt-3">要介護・要支援の訪問看護費を計算します。</p>
          <v-btn color="green-darken-2" size="x-large" block class="mt-6">介護保険を選ぶ</v-btn>
        </v-card-text>
      </v-card>
    </div>
    <v-alert type="warning" variant="tonal" class="mt-8" icon="mdi-help-circle-outline">
      保険の種類が不明な場合は、担当のケアマネジャーまたは主治医へ確認してください。
    </v-alert>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
const router = useRouter();
</script>

<style scoped>
.insurance-select{max-width:980px;margin:40px auto}.insurance-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.insurance-card{cursor:pointer;border-width:2px;color:#1f2937;transition:transform .15s ease,box-shadow .15s ease}.medical-card{background:#f5faff;border-color:#bbdefb}.care-card{background:#f5fbf6;border-color:#c8e6c9}.insurance-card p{color:#54635f}.insurance-card:hover,.insurance-card:focus-visible{transform:translateY(-3px);box-shadow:0 10px 28px rgba(20,63,58,.16);outline:3px solid rgba(25,118,210,.24);outline-offset:2px}@media(max-width:800px){.insurance-cards{grid-template-columns:1fr}.insurance-select{margin-top:16px}}
</style>
