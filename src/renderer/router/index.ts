import { createRouter, createWebHashHistory } from "vue-router";
import MonthlyInputView from "../views/MonthlyInputView.vue";
import CostDetailView from "../views/CostDetailView.vue";
import InsuranceSelectView from "../views/InsuranceSelectView.vue";
import CareMonthlyInputView from "../views/CareMonthlyInputView.vue";
import CareCostDetailView from "../views/CareCostDetailView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "insurance-select", component: InsuranceSelectView },
    { path: "/medical", name: "monthly-input", component: MonthlyInputView, meta: { insurance: "medical" } },
    { path: "/medical/detail", name: "cost-detail", component: CostDetailView, meta: { insurance: "medical" } },
    { path: "/care", name: "care-monthly-input", component: CareMonthlyInputView, meta: { insurance: "care" } },
    { path: "/care/detail", name: "care-cost-detail", component: CareCostDetailView, meta: { insurance: "care" } }
  ]
});
