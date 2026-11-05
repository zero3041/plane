const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const jsx = (type, props) => ({ type, props: { ...props } });
const components = Object.fromEntries(
  [
    "Field",
    "FieldLabel",
    "Input",
    "InputGroup",
    "Popover",
    "PopoverContent",
    "PopoverTrigger",
    "TextArea",
    "TextAreaGroup",
    "Button",
    "Select",
    "SelectContent",
    "SelectItem",
    "SelectList",
    "SelectTrigger",
  ].map((name) => [name, name])
);

function loadComponent(file, exportName, props) {
  const filename = path.join(__dirname, file);
  const { outputText, diagnostics } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  assert.deepEqual(diagnostics, []);
  let hookIndex = 0;
  const states = [];
  const effects = [];
  const exports = {};
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: (initial) => {
        const index = hookIndex++;
        if (!(index in states)) states[index] = initial;
        return [
          states[index],
          (next) => {
            states[index] = typeof next === "function" ? next(states[index]) : next;
          },
        ];
      },
      useEffect: (effect) => effects.push(effect),
    },
    "mobx-react": { observer: (component) => component },
    "@plane/blocks/common": { ColorSwatchPicker: "ColorSwatchPicker" },
    "@plane/blocks/toast": { setToast: () => {} },
    "@plane/constants": { STATE_GROUPS: { started: { color: "blue" } } },
    "@plane/i18n": { useTranslation: () => ({ t: (key) => key }) },
    "@/components/project-states": { StateForm: "StateForm" },
  };
  vm.runInNewContext(
    outputText,
    {
      exports,
      require: (id) => {
        if (id.startsWith("@makeplane/propel/components/")) return components;
        assert.ok(Object.hasOwn(mocks, id), `Chưa mô phỏng dependency: ${id}`);
        return mocks[id];
      },
    },
    { filename }
  );
  const render = () => {
    hookIndex = 0;
    return exports[exportName](props);
  };
  render();
  effects.splice(0).forEach((effect) => effect());
  return { render };
}

function findAll(node, type) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type));
  return [...(node.type === type ? [node] : []), ...findAll(node.props?.children, type)];
}

function setupForm(data) {
  const submitted = [];
  const component = loadComponent("form.tsx", "StateForm", {
    data: { name: "Đang thực hiện", color: "blue", ...data },
    onSubmit: async (payload) => {
      submitted.push(payload);
      return { status: "success" };
    },
    onCancel: () => {},
    buttonDisabled: false,
    buttonTitle: "Lưu",
  });
  const submit = async () => {
    const button = findAll(component.render(), "Button").find((node) => node.props.label === "Lưu");
    await button.props.onClick({ preventDefault() {} });
    return submitted[0];
  };
  return { ...component, submit };
}

for (const group of ["backlog", "unstarted", "started"]) {
  test(`Nhóm ${group} có ba lựa chọn và mặc định normal cho dữ liệu cũ`, async () => {
    const form = setupForm({ group });
    const tree = form.render();
    const select = findAll(tree, "Select")[0];
    assert.ok(select, "Thiếu Select cấu hình attention_kind");
    assert.equal(select.props.value, "normal");
    assert.equal(findAll(tree, "FieldLabel")[0].props.children, "home.personal_dashboard.attention_label");
    assert.deepEqual(
      findAll(tree, "SelectItem").map((item) => [item.props.value, item.props.label]),
      [
        ["normal", "home.personal_dashboard.attention_normal"],
        ["blocked", "home.personal_dashboard.attention_blocked"],
        ["paused", "home.personal_dashboard.attention_paused"],
      ]
    );
    assert.equal((await form.submit()).attention_kind, "normal");
  });
}

for (const kind of ["normal", "blocked", "paused"]) {
  test(`Giữ metadata ${kind} khi sửa và cho phép đổi lựa chọn`, async () => {
    const form = setupForm({ group: "started", attention_kind: kind, description: "Mô tả" });
    const select = findAll(form.render(), "Select")[0];
    assert.ok(select, "Thiếu Select cấu hình attention_kind");
    assert.equal(select.props.value, kind);
    assert.equal((await form.submit()).attention_kind, kind);
    select.props.onValueChange("paused");
    assert.equal(findAll(form.render(), "Select")[0].props.value, "paused");
  });
}

for (const group of ["completed", "cancelled"]) {
  test(`Nhóm ${group} ẩn metadata và buộc normal khi gửi`, async () => {
    const form = setupForm({ group, attention_kind: "blocked" });
    assert.equal(findAll(form.render(), "Select").length, 0);
    assert.equal((await form.submit()).attention_kind, "normal");
  });
}

test("Wrapper tạo truyền group và mặc định normal", () => {
  const wrapper = loadComponent("create.tsx", "StateCreate", {
    groupKey: "started",
    createStateCallback: async () => {},
    handleClose: () => {},
  });
  const data = wrapper.render().props.data;
  assert.equal(data.group, "started");
  assert.equal(data.attention_kind, "normal");
});

test("Wrapper cập nhật giữ nguyên trạng thái và metadata", () => {
  const state = { id: "state-1", group: "started", name: "Chờ", attention_kind: "paused" };
  const wrapper = loadComponent("update.tsx", "StateUpdate", {
    state,
    updateStateCallback: async () => {},
    handleClose: () => {},
  });
  assert.equal(wrapper.render().props.data, state);
});
