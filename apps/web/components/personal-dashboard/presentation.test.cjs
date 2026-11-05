const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

// Bất biến mã nguồn, không thay thế kiểm thử render, tương tác hoặc coverage runtime.
const root = readFileSync(path.join(__dirname, "root.tsx"), "utf8");
const taskList = readFileSync(path.join(__dirname, "task-list.tsx"), "utf8");
const overview = readFileSync(path.join(__dirname, "overview.tsx"), "utf8");

test("bộ lọc workspace dùng Select của Propel thay vì select native", () => {
  assert.match(root, /import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s*["']@makeplane\/propel\/components\/select["']/);
  assert.match(root, /<Select\b/);
  assert.doesNotMatch(root, /<select\b/);
});

test("tiêu đề dashboard dùng typography semantic và không còn text-24", () => {
  assert.match(root, /<h1\b[^>]*className=["'][^"']*\btext-h4-semibold\b/);
  assert.doesNotMatch(root, /\btext-24\b/);
});

test("giữ aria-pressed và đồng bộ bộ lọc workspace/project vào URL", () => {
  assert.match(root, /aria-pressed=\{bucket\s*===\s*item\.key\}/);
  assert.match(root, /onClick=\{\(\)\s*=>\s*changeFilters\(\{ bucket: item\.key \}\)\}/);
  assert.match(
    root,
    /changeFilters\(\{ workspace_slug: nextValue \?\? "", project_id: "" \}\)/,
    "Đổi workspace phải xóa project đang lọc"
  );
  assert.match(root, /changeFilters\(\{ project_id: nextValue \?\? "" \}\)/);
  assert.match(root, /useSearchParams\(\)/);
  assert.match(root, /buildDashboardFilterUrl\(pathname/);
  assert.match(root, /preventScrollReset:\s*true/);
  assert.match(root, /setCursors\(\[null\]\)/);
});

test("danh sách dùng icon từ blocks và typography text-body-sm-medium", () => {
  for (const icon of ["PriorityIcon", "StateGroupIcon"]) {
    assert.match(
      taskList,
      new RegExp(`import\\s*\\{[^}]*\\b${icon}\\b[^}]*\\}\\s*from\\s*["']@plane/blocks/[^"']+["']`),
      `${icon} phải được import từ subpath của @plane/blocks`
    );
    assert.match(taskList, new RegExp(`<${icon}\\b`));
  }
  assert.match(taskList, /className=["'][^"']*\btext-body-sm-medium\b/);
});

test("liên kết công việc tiếp tục dùng generateWorkItemLink với đủ định danh", () => {
  assert.match(taskList, /import\s*\{[^}]*\bgenerateWorkItemLink\b[^}]*\}\s*from\s*["']@plane\/utils["']/);
  const link = taskList.match(/href=\{generateWorkItemLink\(\{([\s\S]*?)\}\)\}/);
  assert.ok(link, "href phải dùng generateWorkItemLink");
  for (const [key, value] of Object.entries({
    workspaceSlug: "workspace.slug",
    projectId: "project.id",
    issueId: "id",
    projectIdentifier: "project.identifier",
    sequenceId: "sequence_id",
  })) {
    assert.match(link[1], new RegExp(`\\b${key}:\\s*issue\\.${value.replaceAll(".", "\\.")}\\b`));
  }
});

test("giữ chỗ dashboard và dữ liệu cũ trong lúc tải bộ lọc mới", () => {
  assert.match(root, /keepPreviousData:\s*true/);
  assert.match(root, /<PersonalDashboardOverview[\s\S]*?overview=\{data\?\.overview\}/);
  assert.match(root, /isLoading=\{isLoading && !data\}/);
  assert.match(overview, /min-h-\[440px\]/);
});

test("danh sách công việc chưa hoàn thành phân trang 10 mục và khóa cache theo cursor", () => {
  assert.match(root, /const PERSONAL_DASHBOARD_PAGE_SIZE = 10/);
  assert.match(root, /per_page:\s*PERSONAL_DASHBOARD_PAGE_SIZE/);
  assert.match(root, /getPersonalDashboardKey\(user\?\.id,\s*dashboardFilters,\s*cursor\)/);
});
