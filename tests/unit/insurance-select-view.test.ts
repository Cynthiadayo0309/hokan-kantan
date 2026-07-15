import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import InsuranceSelectView from "../../src/renderer/views/InsuranceSelectView.vue";

const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

describe("InsuranceSelectView", () => {
  it("起動時に医療保険と介護保険の選択肢を表示する", () => {
    const wrapper = shallowMount(InsuranceSelectView);
    expect(wrapper.text()).toContain("医療保険");
    expect(wrapper.text()).toContain("介護保険");
    expect(wrapper.text()).toContain("どちらの保険で計算しますか？");
  });

  it("介護保険カードから介護入力画面へ遷移する", async () => {
    const wrapper = shallowMount(InsuranceSelectView);
    await wrapper.findAll("v-card")[1].trigger("click");
    expect(push).toHaveBeenCalledWith({ name: "care-monthly-input" });
  });
});
