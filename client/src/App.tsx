import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Unauthorized from './pages/Unauthorized';
import VehiclesList from './pages/VehiclesList';
import VehicleForm from './pages/VehicleForm';
import VehicleDetail from './pages/VehicleDetail';
import DriversList from './pages/DriversList';
import DriverForm from './pages/DriverForm';
import DriverDetail from './pages/DriverDetail';
import TripsList from './pages/TripsList';
import TripForm from './pages/TripForm';
import TripDetail from './pages/TripDetail';
import DispatchBoard from './pages/DispatchBoard';
import MaintenanceList from './pages/MaintenanceList';
import MaintenanceForm from './pages/MaintenanceForm';
import ExpensesList from './pages/ExpensesList';
import VehicleCostSummary from './pages/VehicleCostSummary';
import ReportsAnalytics from './pages/ReportsAnalytics';
import AssistantChat from './pages/AssistantChat';

// Route Guard Component
interface ProtectedRouteProps {
  allowedRoles?: string[];
}

function ProtectedLayout({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
          <span className="text-xs font-semibold text-slate-400">Loading TransitOps AI...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.roleId)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Stub pages for other modules (to verify routing gates without crashing)
function PlaceholderPage({ title, roles }: { title: string; roles: string[] }) {
  const { user } = useAuth();
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <h1 className="text-xl font-bold text-white tracking-tight">{title} Module</h1>
        <p className="text-xs text-slate-400 mt-1">
          This is a placeholder for the {title.toLowerCase()} screen.
        </p>
        <div className="mt-6 p-4 bg-white/5 border border-white/5 rounded-xl text-xs space-y-2 text-slate-300">
          <div><span className="font-semibold text-slate-400">Logged User:</span> {user?.name} ({user?.email})</div>
          <div><span className="font-semibold text-slate-400">User Role:</span> <span className="capitalize">{user?.roleId}</span></div>
          <div><span className="font-semibold text-slate-400">Allowed Roles for this Module:</span> {roles.join(', ')}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Core Protected Routes Layout */}
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Module-specific Role-Gated Routes */}
            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'dispatcher', 'viewer']}
                />
              }
            >
              <Route path="/vehicles" element={<VehiclesList />} />
              <Route path="/vehicles/:id" element={<VehicleDetail />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager']}
                />
              }
            >
              <Route path="/vehicles/new" element={<VehicleForm />} />
              <Route path="/vehicles/edit/:id" element={<VehicleForm />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'safety_officer', 'viewer']}
                />
              }
            >
              <Route path="/drivers" element={<DriversList />} />
              <Route path="/drivers/:id" element={<DriverDetail />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager']}
                />
              }
            >
              <Route path="/drivers/new" element={<DriverForm />} />
              <Route path="/drivers/edit/:id" element={<DriverForm />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'dispatcher', 'driver', 'viewer']}
                />
              }
            >
              <Route path="/trips" element={<TripsList />} />
              <Route path="/trips/:id" element={<TripDetail />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'dispatcher']}
                />
              }
            >
              <Route path="/trips/new" element={<TripForm />} />
              <Route path="/trips/edit/:id" element={<TripForm />} />
            </Route>

            <Route
              element={
                <ProtectedLayout allowedRoles={['superadmin', 'fleet_manager', 'dispatcher']} />
              }
            >
              <Route path="/dispatch" element={<DispatchBoard />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'maintenance_manager', 'viewer']}
                />
              }
            >
              <Route path="/maintenance" element={<MaintenanceList />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'maintenance_manager']}
                />
              }
            >
              <Route path="/maintenance/new" element={<MaintenanceForm />} />
              <Route path="/maintenance/edit/:id" element={<MaintenanceForm />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'financial_analyst', 'driver', 'viewer']}
                />
              }
            >
              <Route path="/expenses" element={<ExpensesList />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'financial_analyst', 'viewer']}
                />
              }
            >
              <Route path="/expenses/summary" element={<VehicleCostSummary />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'financial_analyst', 'viewer']}
                />
              }
            >
              <Route path="/reports" element={<ReportsAnalytics />} />
            </Route>

            <Route
              element={
                <ProtectedLayout
                  allowedRoles={['superadmin', 'fleet_manager', 'dispatcher', 'viewer']}
                />
              }
            >
              <Route path="/assistant" element={<AssistantChat />} />
            </Route>

            <Route
              element={
                <ProtectedLayout allowedRoles={['superadmin', 'fleet_manager']} />
              }
            >
              <Route
                path="/logs"
                element={<PlaceholderPage title="Activity Logs" roles={['superadmin', 'fleet_manager']} />}
              />
            </Route>

            {/* Fallback routes */}
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}
