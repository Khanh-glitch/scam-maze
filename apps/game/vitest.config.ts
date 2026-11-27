import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      exclude: ["src/legacy/**", ...configDefaults.exclude],
      setupFiles: ["./src/test/setup.ts"],
      css: false,
      restoreMocks: true,
      // Sinh một thành phố 4.300 toà mất ~4 s, và vài test phải sinh hai lần để so tính tất định.
      // Chạy song song nhiều file thì 5 s mặc định không đủ — đây là ngân sách thời gian, không
      // phải nới điều kiện kiểm.
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
