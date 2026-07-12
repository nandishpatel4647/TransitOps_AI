import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Truck,
  Users,
  MapPin,
  ClipboardList,
  Wrench,
  DollarSign,
  BarChart3,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bot
} from 'lucide-react';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: ['superadmin', 'fleet_manager', 'dispatcher', 'driver', 'safety_officer', 'financial_analyst', 'maintenance_manager', 'viewer']
  },
  {
    name: 'Vehicles',
    path: '/vehicles',
    icon: Truck,
    roles: ['superadmin', 'fleet_manager', 'dispatcher', 'viewer']
  },
  {
    name: 'Drivers',
    path: '/drivers',
    icon: Users,
    roles: ['superadmin', 'fleet_manager', 'safety_officer', 'viewer']
  },
  {
    name: 'Trips',
    path: '/trips',
    icon: MapPin,
    roles: ['superadmin', 'fleet_manager', 'dispatcher', 'driver', 'viewer']
  },
  {
    name: 'Dispatch Board',
    path: '/dispatch',
    icon: ClipboardList,
    roles: ['superadmin', 'fleet_manager', 'dispatcher']
  },
  {
    name: 'Maintenance',
    path: '/maintenance',
    icon: Wrench,
    roles: ['superadmin', 'fleet_manager', 'maintenance_manager', 'viewer']
  },
  {
    name: 'Fuel & Expenses',
    path: '/expenses',
    icon: DollarSign,
    roles: ['superadmin', 'fleet_manager', 'financial_analyst', 'driver', 'viewer']
  },
  {
    name: 'Reports & Analytics',
    path: '/reports',
    icon: BarChart3,
    roles: ['superadmin', 'fleet_manager', 'financial_analyst', 'viewer']
  },
  {
    name: 'Activity Logs',
    path: '/logs',
    icon: FileText,
    roles: ['superadmin', 'fleet_manager']
  },
  {
    name: 'AI Assistant',
    path: '/assistant',
    icon: Bot,
    roles: ['superadmin', 'fleet_manager', 'dispatcher', 'viewer']
  }
];

export default function Sidebar() {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!user) return null;

  const allowedItems = sidebarItems.filter(item => item.roles.includes(user.roleId));

  return (
    <div
      className={`glass-panel min-h-screen transition-all duration-300 flex flex-col z-20 sticky top-0 ${
        isCollapsed ? 'w-20' : 'w-64'
      } text-slate-100 border-r border-white/10`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-none text-white tracking-wide">TransitOps AI</h1>
              <span className="text-[10px] text-slate-400 font-medium">FLEET CONTROL</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto bg-primary/20 p-2 rounded-lg border border-primary/30">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors absolute -right-3 top-5 bg-slate-900 border border-white/10"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {allowedItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative ${
                isActive
                  ? 'bg-primary/20 text-white font-medium border border-primary/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full" />
                )}
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {!isCollapsed && <span className="text-sm">{item.name}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-white/10 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">User Role</span>
            <span className="text-xs font-semibold text-slate-300 capitalize">
              {user.role.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
