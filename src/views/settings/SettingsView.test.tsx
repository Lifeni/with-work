import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsView from "@/views/settings/SettingsView";
import { resetStores } from "@/test/resetStores";

describe("SettingsView 关于板块", () => {
  beforeEach(() => {
    resetStores();
  });

  it("提供单文件版本下载与 GitHub 仓库链接", () => {
    render(<SettingsView />);

    const download = screen.getByTitle("下载单文件版本（离线可运行）");
    expect(download).toHaveAttribute("href", "./with-work-single.html");
    expect(download).toHaveAttribute("download", "一点微小的工作.html");

    const github = screen.getByTitle("在 GitHub 上查看源码");
    expect(github).toHaveAttribute("href", "https://github.com/Lifeni/with-work");
    expect(github).toHaveAttribute("target", "_blank");
  });
});