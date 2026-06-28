<template>
  <v-dialog :model-value="modelValue" max-width="760" @update:model-value="emit('update:modelValue', $event)">
    <v-sheet class="pa-5 license-notice" rounded="sm">
      <div class="d-flex align-center justify-space-between mb-4">
        <h2 class="text-h6 font-weight-bold">利用条件・免責</h2>
        <v-btn icon="mdi-close" variant="text" aria-label="閉じる" @click="emit('update:modelValue', false)" />
      </div>

      <div class="notice-section">
        <h3 class="text-subtitle-1 font-weight-bold">著作権</h3>
        <p>本アプリおよび付属資料の著作権は開発者に帰属します。</p>
      </div>

      <div class="notice-section">
        <h3 class="text-subtitle-1 font-weight-bold">再配布・販売の禁止</h3>
        <p>開発者の許可なく、本アプリを第三者へ再配布、販売、譲渡、貸与、公開することを禁止します。</p>
      </div>

      <div class="notice-section">
        <h3 class="text-subtitle-1 font-weight-bold">計算結果について</h3>
        <p>本アプリの計算結果は概算です。正式な算定、請求、レセプト、請求額の確定を保証するものではありません。</p>
        <p>実際の請求・算定は、最新の制度、通知、契約内容、専門職の確認に基づいて行ってください。</p>
      </div>

      <div class="notice-section">
        <h3 class="text-subtitle-1 font-weight-bold">責任の範囲</h3>
        <p>本アプリの利用により生じた損害について、法令上認められる範囲で開発者は責任を負いません。</p>
      </div>

      <div class="notice-section">
        <h3 class="text-subtitle-1 font-weight-bold">第三者ライブラリ</h3>
        <p>本アプリにはオープンソースソフトウェアを含む第三者ライブラリが使用されています。各ライブラリの利用条件は、それぞれのライセンスに従います。</p>
      </div>

      <div class="action-row mt-4">
        <v-btn color="primary" prepend-icon="mdi-check" @click="emit('update:modelValue', false)">閉じる</v-btn>
      </div>
    </v-sheet>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>

<style scoped>
.license-notice {
  line-height: 1.7;
}

.notice-section + .notice-section {
  margin-top: 16px;
}

.notice-section p {
  margin: 6px 0 0;
}
</style>
