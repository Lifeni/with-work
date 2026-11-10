import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { NDropdown } from "naive-ui";
import DropdownMenu from "@/components/ui/dropdown-menu.vue";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DropdownMenu", () => {
  it("选择菜单项时发出稳定 key", async () => {
    const wrapper = mount(DropdownMenu, {
      attachTo: document.body,
      props: {
        options: [{ key: "export-backup", label: "导出全部备份" }],
      },
      slots: {
        default: '<button type="button">导出</button>',
      },
    });

    await wrapper.get("button").trigger("click");
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await nextTick();
    const item = Array.from(
      document.body.querySelectorAll<HTMLElement>("[data-dropdown-option]"),
    ).find((option) => option.textContent?.includes("导出全部备份"));
    expect(item).toBeDefined();
    wrapper.findComponent(NDropdown).vm.$emit("select", "export-backup");
    await nextTick();

    expect(wrapper.emitted("select")?.[0]).toEqual(["export-backup"]);
    wrapper.unmount();
  });

  it("菜单具备 menu/menuitem 语义，并可用键盘导航、执行和返回焦点", async () => {
    const wrapper = mount(DropdownMenu, {
      attachTo: document.body,
      props: {
        ariaLabel: "测试操作菜单",
        options: [
          { key: "first", label: "第一项" },
          { key: "second", label: "第二项" },
        ],
      },
      slots: {
        default: '<button type="button">操作</button>',
      },
    });

    const trigger = wrapper.get("button");
    await trigger.trigger("click");
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await nextTick();

    const menu = document.body.querySelector<HTMLElement>('[role="menu"]');
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(menu?.getAttribute("aria-label")).toBe("测试操作菜单");
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);

    items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(items[1]);

    items[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextTick();
    await nextTick();

    expect(wrapper.emitted("select")?.[0]).toEqual(["second"]);
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();
  });
});
