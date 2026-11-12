import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SessionControls from "./components/SessionControls";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/login"));
const Register = lazy(() => import("./pages/register"));
const Announcements = lazy(() => import("./pages/admin/announcements"));
const AdminControl = lazy(() => import("./pages/admin/AdminControl"));
const OsseApprovals = lazy(() => import("./pages/admin/OsseApprovals"));
const CCSAdmin = lazy(() => import("./pages/admin/ccs-admin"));
const CCJEAdmin = lazy(() => import("./pages/admin/ccje-admin"));
const CBMAdmin = lazy(() => import("./pages/admin/cbm-admin"));
const CASAdmin = lazy(() => import("./pages/admin/cas-admin"));
const BTVTEDAdmin = lazy(() => import("./pages/admin/btvted-admin"));
const BSEDAdmin = lazy(() => import("./pages/admin/bsed-admin"));
const StudentPortal = lazy(() => import("./pages/students/StudentPortal"));
const AdminAttendanceScanner = lazy(() => import("./pages/admin/scanner"));
const OrganizationDepartmentA = lazy(() => import("./pages/adminOrg/orgA"));
const OrganizationDepartmentB = lazy(() => import("./pages/adminOrg/orgB"));
const OrganizationDepartmentC = lazy(() => import("./pages/adminOrg/orgC"));
const OrganizationDepartmentD = lazy(() => import("./pages/adminOrg/orgD"));
const OrganizationDepartmentE = lazy(() => import("./pages/adminOrg/orgE"));
const OrganizationDepartmentF = lazy(() => import("./pages/adminOrg/orgF"));

function App() {
  return (
    <BrowserRouter>
      <SessionControls />
      <ToastContainer
        position="top-center"
        autoClose={3500}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        theme="light"
      />
      <Suspense
        fallback={
          <div className="app-loading" role="status">
            Loading CampusConnect…
          </div>
        }
      >
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
          <Route path="/admin/fines" element={<AdminControl />} />
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
          <Route
            path="/admin/ccs/announcements"
            element={<Announcements />}
          />
          <Route
            path="/admin/ccje/announcements"
            element={<Announcements />}
          />
          <Route
            path="/admin/cbm/announcements"
            element={<Announcements />}
          />
          <Route
            path="/admin/cas/announcements"
            element={<Announcements />}
          />
          <Route
            path="/admin/btvted/announcements"
            element={<Announcements />}
          />
          <Route
            path="/admin/bsed/announcements"
            element={<Announcements />}
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
