import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@/lib/monaco";
import favicon from "@/assets/favicon.svg";
import { seedDefaultData } from "@/lib/defaultData";
import { persistPlugin } from "@/stores/persist";
import App from "./App.vue";
import "./index.css";

// Pinia：先挂载持久化插件并激活，再执行种子数据注入（seedDefaultData 内部会访问 store）
const pinia = createPinia();
pinia.use(persistPlugin);
setActivePinia(pinia);

// 首次使用注入内置模板与替换规则（已有数据时不覆盖）
seedDefaultData();

// favicon 以模块方式引入，两种构建模式（Vercel / 单文件 HTML）下都会被内联
const link = document.createElement("link");
link.rel = "icon";
link.type = "image/svg+xml";
link.href = favicon;
document.head.appendChild(link);

createApp(App).use(pinia).mount("#root");
