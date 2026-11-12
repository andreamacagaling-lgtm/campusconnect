export function persistAuthSession(data, rememberMe = false) {
  const { access_token, refresh_token, user } = data || {};
  if (!access_token || !refresh_token || !user) return false;

  const storage = rememberMe ? localStorage : sessionStorage;
  const otherStorage = rememberMe ? sessionStorage : localStorage;
  storage.setItem("campusconnect_token", access_token);
  storage.setItem("campusconnect_refresh_token", refresh_token);
  storage.setItem("campusconnect_user", JSON.stringify(user));
  otherStorage.removeItem("campusconnect_token");
  otherStorage.removeItem("campusconnect_refresh_token");
  otherStorage.removeItem("campusconnect_user");

  if (rememberMe) {
    localStorage.setItem("campusconnect_remember", "true");
  } else {
    localStorage.removeItem("campusconnect_remember");
  }

  return true;
}

export function confirmLogout() {
  window.dispatchEvent(new Event("campusconnect:logout-request"));
  return false;
}

export function getAuthDestination(user) {
  if (user?.admin_type === "osse") return "/admin/osse/events";
  if (user?.admin_type === "organization") {
    const organizationAdminRoutes = {
      1: "/adminOrg/orgA",
      2: "/adminOrg/orgB",
      3: "/adminOrg/orgC",
      4: "/adminOrg/orgD",
      5: "/adminOrg/orgE",
      6: "/adminOrg/orgF",
    };
    return organizationAdminRoutes[Number(user.organization_dept_id)] || "/login";
  }
  if (user?.role !== "admin") return "/students/profile";
  if (user.dept_id === null || user.dept_id === "") {
    return "/admin/AdminControl";
  }

  const departmentAdminRoutes = {
    1: "/admin/ccs",
    2: "/admin/ccje",
    3: "/admin/cbm",
    4: "/admin/cas",
    5: "/admin/btvted",
    6: "/admin/bsed",
  };

  return departmentAdminRoutes[Number(user.dept_id)] || "/login";
}
