import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Sun,
  Moon,
  LogOut,
  User,
  ChevronDown,
  Bell,
  ShieldAlert,
  Wrench,
  Compass,
  Trash2,
  CheckSquare
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (!user) return null;

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Generate breadcrumbs from path
  const pathnames = location.pathname.split('/').filter((x) => x);
  const breadcrumbs = pathnames.map((name, index) => {
    const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
    const isLast = index === pathnames.length - 1;
    const formattedName = name.replace(/-/g, ' ').toUpperCase();

    return (
      <span key={name} className="flex items-center text-xs">
        <span className="mx-2 text-slate-500 font-medium">/</span>
        {isLast ? (
          <span className="text-slate-400 font-semibold">{formattedName}</span>
        ) : (
          <button
            onClick={() => navigate(routeTo)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            {formattedName}
          </button>
        )}
      </span>
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="h-16 border-b border-white/10 glass-panel flex items-center justify-between px-6 z-10 sticky top-0">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          TRANSITOPS
        </button>
        {breadcrumbs}
      </div>

      {/* User Controls */}
      <div className="flex items-center space-x-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-3 p-1.5 pr-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
          >
            <div className="h-8 w-8 rounded-lg overflow-hidden bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-xs text-primary">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${user.avatarUrl}`}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(user.name)
              )}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {user.name}
              </div>
              <div className="text-[10px] text-slate-400 font-medium capitalize">
                {user.role.name}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay to click away */}
              <div
                className="fixed inset-0 z-20"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 rounded-xl glass-panel border border-white/15 p-1.5 shadow-xl z-30">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/profile');
                  }}
                  className="flex items-center w-full space-x-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg text-xs transition-colors"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  <span>Edit Profile</span>
                </button>
                <div className="h-[1px] bg-white/10 my-1" />
                <button
                  onClick={async () => {
                    setDropdownOpen(false);
                    await logout();
                    navigate('/login');
                  }}
                  className="flex items-center w-full space-x-2.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg text-xs transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Poll notifications endpoint every 15 seconds
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications');
      return response.data.notifications;
    },
    refetchInterval: 15000
  });

  const notifications = data || [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // Mutations
  const readMutation = useMutation({
    mutationFn: async (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'LICENSE_EXPIRY':
        return <ShieldAlert className="h-4 w-4 text-rose-400" />;
      case 'MAINTENANCE_DUE':
        return <Wrench className="h-4 w-4 text-violet-400" />;
      default:
        return <Compass className="h-4 w-4 text-emerald-400" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5 relative"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-white font-extrabold text-[8px] flex items-center justify-center rounded-full border border-slate-900 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2.5 w-80 rounded-2xl glass-panel border border-white/15 shadow-2xl p-4 z-30 space-y-4 text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="font-extrabold text-white">System Alerts</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-[9px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center space-x-0.5"
                >
                  <CheckSquare size={10} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
              {notifications.length === 0 ? (
                <div className="text-[10px] text-slate-500 text-center py-6 italic">
                  No system warnings active.
                </div>
              ) : (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl border transition-all flex items-start space-x-2.5 ${
                      n.read
                        ? 'bg-slate-950/20 border-white/5 opacity-70'
                        : 'bg-white/5 border-white/10 ring-1 ring-primary/10'
                    }`}
                  >
                    {/* Icon */}
                    <div className="shrink-0 mt-0.5">{getIcon(n.type)}</div>

                    {/* Body */}
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-slate-200 leading-normal font-medium">{n.message}</p>
                      <span className="text-[8px] text-slate-500 block">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col space-y-1 shrink-0">
                      {!n.read && (
                        <button
                          onClick={() => readMutation.mutate(n.id)}
                          className="text-[9px] font-bold text-primary hover:underline"
                          title="Mark read"
                        >
                          Read
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(n.id)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                        title="Dismiss alert"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
