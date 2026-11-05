const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../../../..");
const jsx = (type, props) => ({ type, props: props ?? {} });
function load(relativePath, mocks) {
  const filename = path.join(root, relativePath);
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
      URL,
      URLSearchParams,
      require: (id) => {
        assert.ok(Object.hasOwn(mocks, id), `Unmocked dependency: ${id}`);
        return mocks[id];
      },
    },
    { filename }
  );
  return exports;
}
const { EPageTypes, EAuthModes } = load("apps/web/helpers/authentication.helper.tsx", {
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "next/link": {},
  "@plane/constants": {},
});
// Use the actual shared validator, not a weaker test-only URL check.
const { isValidNextPath } = load("packages/utils/src/url.ts", { "./tlds": { default: [] } });

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props.children), ...nodes(tree.props.render)];
}
const onboardedProfile = { id: "profile-id", is_onboarded: true };
function renderAuth({
  pageType = EPageTypes.HOME,
  user = { id: "user-id" },
  profile = onboardedProfile,
  pathname = "/",
  query = "",
  userLoading = false,
  swrLoading = false,
  profileLoading = false,
  profileError,
  swrError,
  workspacesLoading = false,
} = {}) {
  const navigation = [];
  const effects = [];
  const swrCalls = [];
  const fetchCurrentUser = async () => user;
  const fetchUserProfile = async () => profile;
  const router = Object.fromEntries(
    ["push", "replace"].map((method) => [method, (href) => navigation.push({ method, href })])
  );
  const { AuthenticationWrapper } = load("apps/web/lib/wrappers/authentication-wrapper.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useEffect: (effect) => effects.push(effect) },
    "mobx-react": { observer: (component) => component },
    "next/navigation": { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(query) },
    swr: {
      default: (key, fetcher) => {
        swrCalls.push({ key, fetcher });
        return {
          isLoading: key === "USER_INFORMATION" ? swrLoading : profileLoading,
          error: key === "USER_INFORMATION" ? swrError : profileError,
        };
      },
    },
    "@plane/utils": { isValidNextPath },
    "@plane/i18n": { useTranslation: () => ({ t: (key) => key }) },
    "@makeplane/propel/components/button": { Button: "Button" },
    "@/components/common/logo-spinner": { LogoSpinner: "LogoSpinner" },
    "@/helpers/authentication.helper": { EPageTypes },
    "@/hooks/store/use-workspace": {
      useWorkspace: () => ({ loader: workspacesLoading, workspaces: { ws: { slug: "last-workspace" } } }),
    },
    "@/hooks/store/user": {
      useUser: () => ({ data: user, isLoading: userLoading, fetchCurrentUser }),
      useUserProfile: () => ({ data: profile, isLoading: profileLoading, error: profileError, fetchUserProfile }),
      useUserSettings: () => ({ data: { workspace: { last_workspace_slug: "last-workspace" } } }),
    },
    "@/hooks/use-app-router": { useAppRouter: () => router },
  });
  const tree = AuthenticationWrapper({ pageType, children: "dashboard", unauthenticatedFallback: "sign-in" });
  // Redirects must not be side effects of rendering.
  assert.deepEqual(navigation, [], "Auth navigation must run after render");
  effects.forEach((effect) => effect());
  return { tree, navigation, swrCalls, fetchCurrentUser, fetchUserProfile };
}
function assertContent(result, expected) {
  assert.ok(
    nodes(result.tree).some((node) => node.props.children === expected),
    `Expected ${expected}`
  );
  assert.deepEqual(result.navigation, []);
}
function assertRedirect(result, expected) {
  assert.deepEqual(result.navigation, [{ method: "replace", href: expected }]);
  assert.ok(!nodes(result.tree).some((node) => ["dashboard", "sign-in"].includes(node.props.children)));
}

test("root has a distinct HOME mode", () => assert.equal(EPageTypes.HOME, "HOME"));
test("onboarded root stays on personal dashboard despite remembered workspace", () =>
  assertContent(renderAuth(), "dashboard"));
test("anonymous root renders sign-in only after user loading has settled", () =>
  assertContent(renderAuth({ user: null }), "sign-in"));
for (const state of [{ swrLoading: true }, { userLoading: true }, { workspacesLoading: true }]) {
  test(`anonymous user gets a loader while ${Object.keys(state)[0]}`, () => {
    const result = renderAuth({ ...state, user: null });
    assert.ok(nodes(result.tree).some((node) => node.type === "LogoSpinner"));
    assert.deepEqual(result.navigation, []);
  });
}
test("cached signed-in user never sees sign-in during background revalidation", () => {
  assertContent(renderAuth({ swrLoading: true, userLoading: true, workspacesLoading: true }), "dashboard");
});
test("wrapper fetches the current user through the existing SWR flow", async () => {
  const result = renderAuth();
  assert.equal(result.swrCalls[0].key, "USER_INFORMATION");
  assert.equal((await result.swrCalls[0].fetcher()).id, "user-id");
});
test("a cached user with an unloaded profile fetches the profile without showing sign-in", async () => {
  const result = renderAuth({ profile: { onboarding_step: {} } });
  const profileRequest = result.swrCalls.find((call) => Array.isArray(call.key));
  assert.equal(profileRequest.key[0], "USER_PROFILE");
  assert.equal(profileRequest.key[1], "user-id");
  assert.ok(await profileRequest.fetcher());
  assert.deepEqual(result.navigation, []);
  assert.ok(nodes(result.tree).some((node) => node.type === "LogoSpinner"));
});
for (const pathname of ["/", "/acme/projects", "/sign-up", "/onboarding"]) {
  test(`waits for an unloaded signed-in profile before routing ${pathname}`, () => {
    const result = renderAuth({ pathname, profile: { onboarding_step: {} }, swrLoading: true, profileLoading: true });
    assert.ok(nodes(result.tree).some((node) => node.type === "LogoSpinner"));
    assert.deepEqual(result.navigation, []);
    assert.ok(
      result.swrCalls.some((call) => call.key && call.key !== "USER_INFORMATION"),
      "Missing profile must be fetched"
    );
  });
}
test("profile failure is not mistaken for required onboarding or anonymous sign-in", () => {
  const result = renderAuth({ profile: {}, profileError: new Error("profile unavailable") });
  assert.deepEqual(result.navigation, []);
  assert.ok(nodes(result.tree).some((node) => node.props.role === "alert"));
});
test("profile failure in the bundled user fetch is not mistaken for anonymous sign-in", () => {
  const result = renderAuth({
    user: null,
    profile: {},
    profileError: new Error("profile unavailable"),
    swrError: new Error("user fetch"),
  });
  assert.deepEqual(result.navigation, []);
  assert.ok(nodes(result.tree).some((node) => node.props.role === "alert"));
});
test("loaded incomplete profile still requires onboarding", () => {
  assertRedirect(renderAuth({ profile: { id: "profile-id", is_onboarded: false } }), "/onboarding");
});
test("legacy completed onboarding steps also allow personal dashboard", () => {
  assertContent(
    renderAuth({
      profile: {
        id: "profile-id",
        onboarding_step: {
          profile_complete: true,
          workspace_join: true,
          workspace_create: true,
          workspace_invite: true,
        },
      },
    }),
    "dashboard"
  );
});
for (const destination of [
  "/acme/projects/?filter=mine#items",
  "/invitations",
  "/accounts/set-password",
  "  /acme  ",
]) {
  test(`root honors validated explicit next_path ${destination}`, () =>
    assertRedirect(
      renderAuth({ query: new URLSearchParams({ next_path: destination }).toString() }),
      destination.trim()
    ));
}
for (const destination of ["/", "/?next_path=/", "/#work", "/a/..", "/./"]) {
  test(`root avoids a same-path redirect loop for ${destination}`, () =>
    assertContent(renderAuth({ query: new URLSearchParams({ next_path: destination }).toString() }), "dashboard"));
}
for (const destination of [
  "https://evil.example",
  "//evil.example",
  "http:evil.example",
  "javascript:alert(1)",
  "/\\evil.example",
  "relative",
]) {
  test(`rejects unsafe next_path ${destination}`, () =>
    assertContent(renderAuth({ query: new URLSearchParams({ next_path: destination }).toString() }), "dashboard"));
}
test("required onboarding preserves explicit destination, including its query string", () => {
  assertRedirect(
    renderAuth({ profile: { id: "p", is_onboarded: false }, query: "next_path=%2Facme%2Fprojects%3Fview%3Dmine" }),
    "/onboarding?next_path=%2Facme%2Fprojects%3Fview%3Dmine"
  );
});
test("onboarding completion returns to personal dashboard by default", () =>
  assertRedirect(renderAuth({ pageType: EPageTypes.ONBOARDING, pathname: "/onboarding" }), "/"));
test("onboarding completion resumes validated explicit destination", () =>
  assertRedirect(
    renderAuth({ pageType: EPageTypes.ONBOARDING, pathname: "/onboarding", query: "next_path=%2Facme%2Fprojects" }),
    "/acme/projects"
  ));
test("onboarding does not redirect to itself", () =>
  assertRedirect(
    renderAuth({ pageType: EPageTypes.ONBOARDING, pathname: "/onboarding/", query: "next_path=%2Fonboarding" }),
    "/"
  ));
test("incomplete onboarding renders its own screen", () =>
  assertContent(
    renderAuth({ pageType: EPageTypes.ONBOARDING, pathname: "/onboarding", profile: { id: "p", is_onboarded: false } }),
    "dashboard"
  ));
test("signed-in auth-only screen returns to global home", () =>
  assertRedirect(renderAuth({ pageType: EPageTypes.NON_AUTHENTICATED, pathname: "/sign-up" }), "/"));
test("auth-only screen does not follow a self-referencing next_path", () =>
  assertRedirect(
    renderAuth({ pageType: EPageTypes.NON_AUTHENTICATED, pathname: "/sign-up/", query: "next_path=%2Fsign-up" }),
    "/"
  ));
test("anonymous auth-only screen remains available", () =>
  assertContent(renderAuth({ pageType: EPageTypes.NON_AUTHENTICATED, user: null, pathname: "/sign-up" }), "dashboard"));
test("authenticated workspace pages stay available to onboarded users", () =>
  assertContent(renderAuth({ pageType: EPageTypes.AUTHENTICATED, pathname: "/acme" }), "dashboard"));
test("protected anonymous route preserves query in encoded sign-in return path", () => {
  assertRedirect(
    renderAuth({
      pageType: EPageTypes.AUTHENTICATED,
      user: null,
      pathname: "/acme/projects/",
      query: "view=mine&name=A%26B",
    }),
    "/?next_path=%2Facme%2Fprojects%2F%3Fview%3Dmine%26name%3DA%2526B"
  );
});
test("protected route carries its destination through required onboarding", () => {
  assertRedirect(
    renderAuth({
      pageType: EPageTypes.AUTHENTICATED,
      pathname: "/acme/projects/",
      profile: { id: "p", is_onboarded: false },
    }),
    "/onboarding?next_path=%2Facme%2Fprojects%2F"
  );
});
test("set-password stays available for autoset passwords", () =>
  assertContent(
    renderAuth({
      pageType: EPageTypes.SET_PASSWORD,
      pathname: "/accounts/set-password",
      user: { id: "u", is_password_autoset: true },
    }),
    "dashboard"
  ));
test("already-set password returns to global home", () =>
  assertRedirect(
    renderAuth({
      pageType: EPageTypes.SET_PASSWORD,
      pathname: "/accounts/set-password",
      user: { id: "u", is_password_autoset: false },
    }),
    "/"
  ));
test("public routes stay public", () =>
  assertContent(renderAuth({ pageType: EPageTypes.PUBLIC, user: null }), "dashboard"));
test("root wires personal dashboard and anonymous sign-in through HOME wrapper", () => {
  const HomePage = load("apps/web/app/(home)/page.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {},
    "@/components/auth-screens/auth-base": { AuthBase: "AuthBase" },
    "@/components/personal-dashboard/root": { PersonalDashboard: "PersonalDashboard" },
    "@/helpers/authentication.helper": { EPageTypes, EAuthModes },
    "@/layouts/default-layout": { default: "DefaultLayout" },
    "@/lib/wrappers/authentication-wrapper": { AuthenticationWrapper: "AuthenticationWrapper" },
  }).default;
  const tree = HomePage();
  const wrapper = nodes(tree).find((node) => node.type === "AuthenticationWrapper");
  assert.equal(wrapper.props.pageType, EPageTypes.HOME);
  assert.equal(wrapper.props.children.type, "PersonalDashboard");
  assert.equal(wrapper.props.unauthenticatedFallback.type, "AuthBase");
  assert.equal(wrapper.props.unauthenticatedFallback.props.authType, EAuthModes.SIGN_IN);
});
test("workspace switcher exposes a distinct global Your work link", () => {
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useState: () => [true, () => {}], useEffect: () => {} },
    "mobx-react": { observer: (component) => component },
    "next/link": { default: "Link" },
    "@makeplane/propel/icons": {},
    "@makeplane/propel/components/icon": { Icon: "Icon" },
    "@makeplane/propel/components/menu": Object.fromEntries(
      ["Menu", "MenuContent", "MenuItem", "MenuSeparator", "MenuTrigger"].map((key) => [key, key])
    ),
    "@plane/i18n": { useTranslation: () => ({ t: (key) => key }) },
    "@plane/blocks/toast": {},
    "@plane/blocks/skeleton": { Loader: "Loader" },
    "@plane/utils": { cn: () => "", orderWorkspacesList: (items) => items },
    "@/components/sidebar/sidebar-item": { AppSidebarItem: { Icon: "SidebarIcon" } },
    "@/hooks/store/use-app-theme": {
      useAppTheme: () => ({ toggleSidebar: () => {}, toggleAnySidebarDropdown: () => {} }),
    },
    "@/hooks/store/use-workspace": { useWorkspace: () => ({ workspaces: {} }) },
    "@/hooks/store/use-instance": { useInstance: () => ({ config: {} }) },
    "@/hooks/store/user": {
      useUser: () => ({ data: { email: "u@example.test" } }),
      useUserProfile: () => ({ updateUserProfile: () => {} }),
    },
    "../logo": { WorkspaceLogo: "WorkspaceLogo" },
    "./dropdown-item": { default: "SidebarDropdownItem" },
  };
  const { WorkspaceMenuRoot } = load("apps/web/components/workspace/sidebar/workspace-menu-root.tsx", mocks);
  for (const variant of ["sidebar", "top-navigation"]) {
    const link = nodes(WorkspaceMenuRoot({ variant })).find(
      (node) => node.type === "MenuItem" && node.props.render?.props.href === "/"
    );
    assert.ok(link, "Expected global home menu link");
    assert.equal(link.props.label, "your_work");
  }
});
