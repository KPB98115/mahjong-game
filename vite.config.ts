import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidVue } from "@void/vue/plugin";

export default defineConfig({
  plugins: [voidPlugin(), voidVue()],
  publicDir: "src/static/pwa",
});
