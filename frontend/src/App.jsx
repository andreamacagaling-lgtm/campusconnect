import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/login";
import Register from "./pages/register";
import Announcements from "./pages/admin/announcements";
import AdminControl from "./pages/admin/AdminControl";
import OsseApprovals from "./pages/admin/OsseApprovals";
import CCSAdmin from "./pages/admin/ccs-admin";
import CCJEAdmin from "./pages/admin/ccje-admin";
import CBMAdmin from "./pages/admin/cbm-admin";
import CASAdmin from "./pages/admin/cas-admin";
import BTVTEDAdmin from "./pages/admin/btvted-admin";
import BSEDAdmin from "./pages/admin/bsed-admin";
import StudentPortal from "./pages/students/StudentPortal";
import AdminAttendanceScanner from "./pages/admin/scanner";
import OrganizationDepartmentA from "./pages/adminOrg/orgA";
import OrganizationDepartmentB from "./pages/adminOrg/orgB";
import OrganizationDepartmentC from "./pages/adminOrg/orgC";
import OrganizationDepartmentD from "./pages/adminOrg/orgD";
import OrganizationDepartmentE from "./pages/adminOrg/orgE";
import OrganizationDepartmentF from "./pages/adminOrg/orgF";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminControl />} />
        <Route
          path="/admin/calendar"
          element={<Navigate to="/admin/events" replace />}
        />
        <Route
          path="/admin/AdminControl"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route path="/admin/events" element={<AdminControl />} />
        <Route path="/admin/attendance" element={<AdminControl />} />
        <Route path="/admin/profile" element={<AdminControl />} />
        <Route
          path="/admin/organization-admins"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route path="/admin/osse/*" element={<OsseApprovals />} />
        <Route path="/admin/adminprofile" element={<Navigate to="/admin/profile" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/students/*" element={<StudentPortal />} />

        <Route path="/admin/announcements" element={<Announcements />} />
        <Route
          path="/admin/organizations"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route
          path="/adminOrg/orgA"
          element={<OrganizationDepartmentA />}
        />
        <Route
          path="/adminOrg/orgB"
          element={<OrganizationDepartmentB />}
        />
        <Route
          path="/adminOrg/orgC"
          element={<OrganizationDepartmentC />}
        />
        <Route
          path="/adminOrg/orgD"
          element={<OrganizationDepartmentD />}
        />
        <Route
          path="/adminOrg/orgE"
          element={<OrganizationDepartmentE />}
        />
        <Route
          path="/adminOrg/orgF"
          element={<OrganizationDepartmentF />}
        />
        <Route path="/admin/ccs/*" element={<CCSAdmin />} />
        <Route
          path="/admin/ccs-events"
          element={<Navigate to="/admin/ccs/events" replace />}
        />
        <Route
          path="/admin/ccje/*"
          element={<CCJEAdmin />}
        />
        <Route
          path="/admin/ccje-events"
          element={<Navigate to="/admin/ccje/events" replace />}
        />
        <Route path="/admin/cbm/*" element={<CBMAdmin />} />
        <Route
          path="/admin/cbm-events"
          element={<Navigate to="/admin/cbm/events" replace />}
        />
        <Route path="/admin/cas/*" element={<CASAdmin />} />
        <Route
          path="/admin/cas-events"
          element={<Navigate to="/admin/cas/events" replace />}
        />
        <Route path="/admin/btvted/*" element={<BTVTEDAdmin />} />
        <Route
          path="/admin/btvted-events"
          element={<Navigate to="/admin/btvted/events" replace />}
        />
        <Route path="/admin/bsed/*" element={<BSEDAdmin />} />
        <Route
          path="/admin/bsed-events"
          element={<Navigate to="/admin/bsed/events" replace />}
        />
        <Route path="/admin/scanner" element={<AdminAttendanceScanner />} />
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
