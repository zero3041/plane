const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the components without loading stores, network clients, or a live workspace.
const localesDirectory = path.resolve(__dirname, "../../../../packages/i18n/src/locales/vi-VN");
const translations = Object.assign(
  {},
  ...["common", "project-settings", "workspace-settings"].map((namespace) =>
    JSON.parse(readFileSync(path.join(localesDirectory, `${namespace}.json`), "utf8"))
  )
);
const translate = (key) => {
  const value = key.split(".").reduce((node, part) => node?.[part], translations);
  assert.equal(typeof value, "string", `Missing string translation: ${key}`);
  return value;
};

const jsx = (type, props) => ({ type, props: props ?? {} });

const flows = [
  {
    name: "delete project",
    file: "delete-project-modal.tsx",
    component: "DeleteProjectModal",
    nameField: "projectName",
    phraseField: "confirmDelete",
    phrase: "delete my project",
    title: "Xóa dự án",
    idle: "Xóa dự án",
    pending: "Đang xóa",
    guardsButton: true,
  },
  {
    name: "leave project",
    file: "leave-project-modal.tsx",
    component: "LeaveProjectModal",
    nameField: "projectName",
    phraseField: "confirmLeave",
    phrase: "Leave Project",
    title: "Rời dự án",
    idle: "Rời dự án",
    pending: "Đang rời",
    guardsButton: false,
  },
  {
    name: "delete workspace",
    file: "../workspace/delete-workspace-form.tsx",
    component: "DeleteWorkspaceForm",
    nameField: "workspaceName",
    phraseField: "confirmDelete",
    phrase: "delete my workspace",
    title: "Bạn có chắc chắn muốn xóa không gian làm việc này không?",
    idle: "Xác nhận",
    pending: "Đang xóa",
    guardsButton: true,
  },
];

function renderFlow(
  flow,
  {
    name = "Dự án Việt hóa 🚀 ' ;",
    values,
    isSubmitting = false,
    fails = false,
    hasTarget = true,
    hasWorkspace = true,
  } = {}
) {
  const formValues = values ?? { [flow.nameField]: name, [flow.phraseField]: flow.phrase };
  const calls = [];
  const toasts = [];
  const action = async (...args) => {
    calls.push(args);
    if (fails) throw new Error("Mock service failure");
  };
  const form = {
    control: {},
    formState: { errors: {}, isSubmitting },
    handleSubmit: (onSubmit) => () => onSubmit(formValues),
    watch: (field) => formValues[field],
    reset: () => {},
  };
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "mobx-react": { observer: (component) => component },
    "next/navigation": {
      useParams: () => ({ workspaceSlug: hasWorkspace ? "workspace-test" : undefined, projectId: "target-id" }),
    },
    "react-hook-form": { Controller: "Controller", useForm: () => form },
    "@makeplane/propel/icons": { WarningTriangleOutline: "WarningTriangleOutline" },
    "@makeplane/propel/components/field": { Field: "Field" },
    "@makeplane/propel/components/input": { Input: "Input", InputGroup: "InputGroup" },
    "@makeplane/propel/components/button": { Button: "Button" },
    "@makeplane/propel/components/dialog": Object.fromEntries(
      [
        "Dialog",
        "DialogActions",
        "DialogBody",
        "DialogContent",
        "DialogHeader",
        "DialogHeading",
        "DialogMain",
        "DialogTitle",
      ].map((componentName) => [componentName, componentName])
    ),
    "@plane/blocks/toast": { setToast: (toast) => toasts.push(toast) },
    "@plane/i18n": { useTranslation: () => ({ t: translate }) },
    "@plane/utils": { cn: (...classes) => classes.join(" ") },
    "@/hooks/store/use-project": { useProject: () => ({ deleteProject: action }) },
    "@/hooks/store/user": {
      useUserPermissions: () => ({ leaveProject: action }),
      useUserSettings: () => ({ fetchCurrentUserSettings: async () => {} }),
    },
    "@/hooks/store/use-workspace": {
      useWorkspace: () => ({ deleteWorkspace: action, getWorkspaceRedirectionUrl: () => "/profile" }),
    },
    "@/hooks/use-app-router": { useAppRouter: () => ({ push: () => {} }) },
  };
  const filename = path.resolve(__dirname, flow.file);
  const { outputText, diagnostics } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  assert.deepEqual(diagnostics, []);
  const exports = {};
  vm.runInNewContext(
    outputText,
    {
      exports,
      require: (id) => {
        assert.ok(Object.hasOwn(mocks, id), `Unmocked dependency: ${id}`);
        return mocks[id];
      },
      setTimeout: () => 1,
      clearTimeout: () => {},
    },
    { filename }
  );
  const target = hasTarget ? { name, id: "target-id", slug: "workspace-test" } : null;
  const tree = exports[flow.component]({ project: target, data: target, isOpen: true, onClose: () => {} });
  return { tree, calls, toasts };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  const children =
    tree.type === "Controller"
      ? tree.props.render({ field: { value: "", onChange: () => {}, ref: () => {} } })
      : tree.props.children;
  return [tree, ...nodes(children)];
}

function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props.children) : String(tree);
}

function submit(tree) {
  return nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit();
}

for (const flow of flows) {
  test(`${flow.name}: Vietnamese title, buttons, and pending state`, () => {
    const { tree } = renderFlow(flow);
    const rendered = nodes(tree);
    assert.equal(text(rendered.find((node) => node.type === "DialogTitle")), flow.title);
    assert.equal(rendered.find((node) => node.type === "Button" && node.props.type !== "submit").props.label, "Hủy");
    assert.equal(rendered.find((node) => node.props.type === "submit").props.label, flow.idle);
    const pendingButton = nodes(renderFlow(flow, { isSubmitting: true }).tree).find(
      (node) => node.props.type === "submit"
    );
    assert.equal(pendingButton.props.label, flow.pending);
    assert.equal(pendingButton.props.loading, true);
  });

  test(`${flow.name}: displayed phrase and Vietnamese placeholder match exact validation`, async () => {
    const { tree, calls } = renderFlow(flow);
    assert.ok(text(tree).includes(flow.phrase));
    const input = nodes(tree).find((node) => node.type === "Input" && node.props.name === flow.phraseField);
    assert.equal(input.props.placeholder, `Nhập '${flow.phrase}'`);
    if (flow.guardsButton) assert.equal(nodes(tree).find((node) => node.props.type === "submit").props.disabled, false);
    await submit(tree);
    assert.deepEqual(calls, [flow.name === "delete workspace" ? ["workspace-test"] : ["workspace-test", "target-id"]]);
  });

  test(`${flow.name}: incorrect, empty, null, invalid, and inexact confirmations never invoke services`, async () => {
    const invalidInputs = [
      undefined,
      null,
      "",
      123,
      {},
      [],
      flow.phrase.toUpperCase(),
      flow.phrase.toLowerCase() === flow.phrase ? "wrong phrase" : flow.phrase.toLowerCase(),
      ` ${flow.phrase}`,
      `${flow.phrase} `,
      flow.phrase + String.fromCodePoint(0x200b),
      "x".repeat(10000),
    ];
    await Promise.all(
      invalidInputs.flatMap((input) =>
        [flow.nameField, flow.phraseField].map(async (field) => {
          const values = { [flow.nameField]: "Dự án", [flow.phraseField]: flow.phrase, [field]: input };
          const { tree, calls } = renderFlow(flow, { name: "Dự án", values });
          if (flow.guardsButton)
            assert.equal(nodes(tree).find((node) => node.props.type === "submit").props.disabled, true);
          await submit(tree);
          assert.deepEqual(calls, [], `Must reject invalid ${field}: ${String(input)}`);
        })
      )
    );
  });

  test(`${flow.name}: handles service failures with Vietnamese error feedback`, async () => {
    const { tree, calls, toasts } = renderFlow(flow, { fails: true });
    await submit(tree);
    assert.equal(calls.length, 1);
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].type, "error");
    assert.match(toasts[0].message, /Vui lòng|thử lại/);
  });
}

test("leave project: required project name has a relevant Vietnamese validation message", () => {
  const flow = flows[1];
  const controller = nodes(renderFlow(flow).tree).find(
    (node) => node.type === "Controller" && node.props.name === "projectName"
  );
  assert.equal(controller.props.rules.required, "Tên là bắt buộc");
});

test("leave project: wrong phrase feedback names the exact case-sensitive phrase", async () => {
  const { tree, calls, toasts } = renderFlow(flows[1], {
    name: "Dự án",
    values: { projectName: "Dự án", confirmLeave: "leave project" },
  });
  await submit(tree);
  assert.deepEqual(calls, []);
  assert.ok(toasts[0].message.includes("'Leave Project'"));
});

test("workspace deletion: Vietnamese warning explains permanent loss and cannot be restored", () => {
  const { tree } = renderFlow(flows[2], { name: "Không gian Việt hóa" });
  assert.match(text(tree), /Không gian Việt hóa/);
  assert.match(text(tree), /vĩnh viễn/);
  assert.match(text(tree), /không thể khôi phục/);
  assert.doesNotMatch(text(tree), /You are about|For final confirmation|Tread very carefully/);
});

test("missing route or workspace target never invokes destructive services", async () => {
  await Promise.all(
    flows.slice(0, 2).map(async (flow) => {
      const { tree, calls } = renderFlow(flow, { hasWorkspace: false });
      await submit(tree);
      assert.deepEqual(calls, []);
    })
  );
  const { tree, calls } = renderFlow(flows[2], { hasTarget: false });
  await submit(tree);
  assert.deepEqual(calls, []);
});
