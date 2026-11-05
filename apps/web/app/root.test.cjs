const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../../..");
const jsx = (type, props) => ({ type, props: { ...props } });

function loadRoot({ hasWindow }) {
  const filename = path.join(root, "apps/web/app/root.tsx");
  const { outputText, diagnostics } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  assert.deepEqual(diagnostics, []);

  let state = false;
  const effects = [];
  const exports = {};
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useEffect: (effect) => effects.push(effect),
      useState: (initialValue) => [state || initialValue, (nextValue) => (state = nextValue)],
    },
    "react-router": { Links: "Links", Meta: "Meta", Outlet: "Outlet", Scripts: "Scripts" },
    "next-themes": { ThemeProvider: "ThemeProvider", useTheme: () => ({ resolvedTheme: "light" }) },
    "@plane/constants": { SITE_DESCRIPTION: "description", SITE_NAME: "Plane" },
    "@/components/common/logo-spinner": { LogoSpinner: "LogoSpinner" },
    "@/lib/stale-asset-error": { isStaleAssetError: () => false, recoverFromStaleAsset: () => {} },
    "./error": { CustomErrorComponent: "CustomErrorComponent" },
    "@/app/assets/favicon/favicon-16x16.png?url": { default: "favicon16" },
    "@/app/assets/favicon/favicon-32x32.png?url": { default: "favicon32" },
    "@/app/assets/favicon/favicon.ico?url": { default: "faviconIco" },
    "@/app/assets/icons/icon-180x180.png?url": { default: "icon180" },
    "@/app/assets/icons/icon-512x512.png?url": { default: "icon512" },
    "@/app/assets/og-image.png?url": { default: "ogImage" },
    "@/styles/globals.css?url": { default: "globalStyles" },
    "@fontsource-variable/inter": {},
    "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url": { default: "interFont" },
    "@fontsource/material-symbols-rounded": {},
    "@fontsource/ibm-plex-mono": {},
  };

  const context = {
    exports,
    URL,
    URLSearchParams,
    require: (id) => {
      assert.ok(Object.hasOwn(mocks, id), `Unmocked dependency: ${id}`);
      return mocks[id];
    },
  };
  if (hasWindow) context.window = {};

  // import.meta thuộc Vite, không được thực thi trong kiểm thử CommonJS này.
  vm.runInNewContext(outputText.replaceAll("import.meta.env.PROD", "false"), context, { filename });
  return { HydrateFallback: exports.HydrateFallback, effects, render: () => exports.HydrateFallback() };
}

test("HydrateFallback giữ markup rỗng ở SSR và lần render client đầu tiên", () => {
  const server = loadRoot({ hasWindow: false });
  const client = loadRoot({ hasWindow: true });

  assert.deepEqual(server.render(), { type: "div", props: {} });
  assert.deepEqual(client.render(), server.render());
  assert.equal(client.effects.length, 1);
});

test("HydrateFallback chỉ hiển thị spinner sau khi client mount", () => {
  const client = loadRoot({ hasWindow: true });

  assert.deepEqual(client.render(), { type: "div", props: {} });
  client.effects[0]();

  assert.equal(client.render().props.className, "relative flex h-screen w-full items-center justify-center bg-canvas");
  assert.equal(client.render().props.children.type, "LogoSpinner");
});
