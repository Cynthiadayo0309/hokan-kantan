import { createRouter, createWebHashHistory } from "vue-router";
import MonthlyInputView from "../views/MonthlyInputView.vue";
import CostDetailView from "../views/CostDetailView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "monthly-input", component: MonthlyInputView },
    { path: "/detail", name: "cost-detail", component: CostDetailView }
  ]
});
