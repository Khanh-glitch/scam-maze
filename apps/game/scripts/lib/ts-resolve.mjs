// Node chỉ cần thêm đuôi `.ts` cho các import không đuôi (repo dùng bundler). Một hook resolve nhỏ,
// không cần cài tsx/esbuild — sandbox không cài thêm được gói ngoài.
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// JSON import trong repo viết `import data from "./x.json"` không kèm attribute (bundler tự lo).
registerHooks({
  load(url, context, next) {
    if (url.endsWith(".json")) {
      const raw = readFileSync(fileURLToPath(url), "utf8");
      return { format: "module", source: `export default ${raw};`, shortCircuit: true };
    }
    return next(url, context);
  },
  resolve(specifier, context, next) {
    if ((specifier.startsWith(".") || specifier.startsWith("/")) && context.parentURL) {
      // Thử TRƯỚC `next`: file không đuôi trong repo là `.ts`, nhưng Node còn thử "file không đuôi"
      // và ném lỗi trước khi ta kịp thêm đuôi.
      for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(url)) && !fileURLToPath(url).endsWith("/")) return next(url.href, context);
      }
    }
    return next(specifier, context);
  },
});
