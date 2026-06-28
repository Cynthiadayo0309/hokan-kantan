import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LicenseNoticeDialog from "../../src/renderer/components/LicenseNoticeDialog.vue";

describe("LicenseNoticeDialog", () => {
  it("shows copyright, redistribution prohibition, and disclaimer", () => {
    const wrapper = shallowMount(LicenseNoticeDialog, {
      props: {
        modelValue: true
      }
    });

    expect(wrapper.text()).toContain("利用条件・免責");
    expect(wrapper.text()).toContain("著作権");
    expect(wrapper.text()).toContain("再配布、販売");
    expect(wrapper.text()).toContain("計算結果は概算");
    expect(wrapper.text()).toContain("正式な算定、請求、レセプト、請求額の確定を保証するものではありません");
  });
});
