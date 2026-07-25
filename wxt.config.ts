import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "Mapa T-Mobile+",
    description: "Rozszerza mapę T-Mobile o nowe, przydatne funkcje",
    permissions: ["storage"],
    host_permissions: ["https://btsearch.pl/*"],
    web_accessible_resources: [
      {
        resources: ["airfiber-watcher.js"],
        matches: ["https://www.t-mobile.pl/*"],
      },
    ],
  },
});
