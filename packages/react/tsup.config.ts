import { defineConfig } from "tsup";

export default defineConfig({
  // Lets Next.js (App Router) import the provider and hooks from a Server Component file.
  banner: {
    js: '"use client";',
  },

  bundle: true,

  clean: true,

  dts: {
    compilerOptions: {
      paths: {},
    },
    resolve: false,
  },
  entry: {
    index: "src/index.ts",
  },

  external: [
    "react",
    "@usehotkeys/core",
  ],

  format: [
    "esm",
    "cjs",
  ],

  minify: false,

  outDir: "dist",

  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },

  platform: "browser",

  sourcemap: true,

  splitting: false,

  target: "es2022",

  treeshake: false,
});
