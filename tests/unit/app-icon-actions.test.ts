import { shallowMount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/renderer/App.vue";

vi.mock("vue-router", () => ({
  useRoute: () => ({ name: "monthly-input" })
}));

describe("App icon actions", () => {
  function stubApi(hasCustomIcon: boolean) {
    const api = {
      getIconPreference: vi.fn().mockResolvedValue({ hasCustomIcon, message: "アイコン設定を読み込みました。" }),
      selectCustomIcon: vi.fn().mockResolvedValue({ applied: true, message: "アイコンを変更しました。" }),
      resetCustomIcon: vi.fn().mockResolvedValue({ applied: true, message: "標準のアイコンに戻しました。" })
    };
    Object.defineProperty(window, "hokanApi", {
      configurable: true,
      value: api
    });
    return api;
  }

  it("shows icon change action and calls select API", async () => {
    const api = stubApi(false);
    const wrapper = shallowMount(App, {
      global: {
        plugins: [createPinia()],
        stubs: {
          "router-view": true
        }
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.text()).toContain("アイコン変更");

    const button = wrapper.findAll("v-btn").find((item) => item.text().includes("アイコン変更"));
    await button?.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.selectCustomIcon).toHaveBeenCalled();
  });

  it("shows reset action when custom icon is active", async () => {
    stubApi(true);
    const wrapper = shallowMount(App, {
      global: {
        plugins: [createPinia()],
        stubs: {
          "router-view": true
        }
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.text()).toContain("標準に戻す");
  });
});
