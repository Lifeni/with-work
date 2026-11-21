import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import favicon from "@/assets/favicon.svg";
import { seedDefaultData } from "@/lib/defaultData";
import { initPwaInstall } from "@/lib/pwaInstall";
import { loadRecentFiles } from "@/lib/recentFiles";
import { hydratePersistence, persistPlugin } from "@/stores/persist";
import App from "./App.vue";
import "./index.css";

async function bootstrap() {
  // favicon 以模块方式引入，由 Vite 统一处理资源的哈希与缓存
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = favicon;
  document.head.appendChild(link);

  // 请求持久化存储，降低浏览器在空间紧张时回收本地数据的概率
  if (navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => {});
  }
  initPwaInstall();

  // 先把 IndexedDB 主存储中的最新数据回填到同步镜像，再创建 store。
  // 这样现有 Pinia 插件无需改成异步，也不会在首屏短暂显示旧数据。
  await hydratePersistence();
  // 预载最近文件句柄，保证启动后直接 Ctrl+S 也能判断原文件绑定
  await loadRecentFiles();

  // Pinia：先挂载持久化插件并激活，再执行种子数据注入（seedDefaultData 内部会访问 store）
  const pinia = createPinia();
  pinia.use(persistPlugin);
  setActivePinia(pinia);

  const app = createApp(App);
  app.use(pinia); // install：此前的 pinia.use(插件) 在此刻真正注册到 _p

  // 首次使用注入内置模板与替换规则（已有数据时不覆盖）
  // 必须在 install 之后调用：store 创建时才能拿到持久化插件
  seedDefaultData();

  app.mount("#root");
}

void bootstrap();
