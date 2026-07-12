import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../lib/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Truck,
  Users,
  MapPin,
  Activity,
  Wrench,
  AlertTriangle,
  TrendingUp,
  Coins,
  ChevronDown,
  Clock,
  ShieldCheck,
  Ban,
  FileText
} from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ComponentType<any>;
  delay?: number;
}

function KPICard({ title, value, subtext, icon: Icon, delay = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="glass-panel p-5 rounded-2xl border border-white/10 flex items-start justify-between relative overflow-hidden"
    >
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
          {title}
        </span>
        <span className="text-2xl font-extrabold text-white block tracking-tight">
          {value}
        </span>
        <span className="text-[10px] text-slate-400 font-medium block">
          {subtext}
        </span>
      </div>
      <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-primary shrink-0">
        <Icon className="h-5 w-5" />
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('');
  const [region, setRegion] = useState('');

  // Fetch Stats using react-query
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardStats', vehicleType, vehicleStatus, region],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats', {
        params: {
          vehicleType: vehicleType || undefined,
          vehicleStatus: vehicleStatus || undefined,
          region: region || undefined,
        },
      });
      return response.data;
    },
  });

  const handleClearFilters = () => {
    setVehicleType('');
    setVehicleStatus('');
    setRegion('');
  };

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 text-center max-w-md">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <h2 className="text-sm font-bold text-white mb-2">Failed to Load Dashboard Data</h2>
          <p className="text-xs text-slate-400 leading-normal mb-4">
            Could not retrieve analytics. Please verify database connection and credentials.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Soft HSL colors mapping for Vehicle Statuses
  const COLORS = {
    Available: '#10b981',  // Emerald
    'On Trip': '#3b82f6',   // Blue
    'In Shop': '#f59e0b',   // Amber
    Breakdown: '#ef4444',   // Red
    Reserved: '#8b5cf6',    // Violet
    Retired: '#64748b',     // Slate
  };

  const getStatusColor = (status: string) => {
    return COLORS[status as keyof typeof COLORS] || '#94a3b8';
  };

  const chartThemeColors = {
    grid: 'rgba(255, 255, 255, 0.05)',
    tooltipBg: 'rgba(15, 23, 42, 0.95)',
    tooltipBorder: 'rgba(255, 255, 255, 0.1)',
    text: '#94a3b8',
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* 1. Header & Filters Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Activity className="h-5 w-5 text-primary" />
            <span>Operations Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time status updates, logistics analytics, and alerts.</p>
        </div>

        {/* Dynamic Filters Form */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Vehicle Type Filter */}
          <div className="relative">
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="appearance-none bg-slate-900/60 border border-white/10 rounded-xl pl-3.5 pr-8 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[120px]"
            >
              <option value="">Vehicle Type</option>
              <option value="Cargo Van">Cargo Van</option>
              <option value="Semi-Truck">Semi-Truck</option>
              <option value="Truck">Box Truck</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          </div>

          {/* Vehicle Status Filter */}
          <div className="relative">
            <select
              value={vehicleStatus}
              onChange={(e) => setVehicleStatus(e.target.value)}
              className="appearance-none bg-slate-900/60 border border-white/10 rounded-xl pl-3.5 pr-8 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[120px]"
            >
              <option value="">Status</option>
              <option value="Available">Available</option>
              <option value="On Trip">On Trip</option>
              <option value="In Shop">In Shop</option>
              <option value="Reserved">Reserved</option>
              <option value="Breakdown">Breakdown</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          </div>

          {/* Region Filter */}
          <div className="relative">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="appearance-none bg-slate-900/60 border border-white/10 rounded-xl pl-3.5 pr-8 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[110px]"
            >
              <option value="">Region</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          </div>

          {/* Reset Filters */}
          {(vehicleType || vehicleStatus || region) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 2. Loading State skeletons */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white/5 border border-white/10 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-white/5 border border-white/10 rounded-2xl animate-pulse" />
            <div className="h-80 bg-white/5 border border-white/10 rounded-2xl animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* 3. Metrics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Active Fleet Size"
              value={data.kpis.activeVehicles}
              subtext="Excluding retired vehicles"
              icon={Truck}
              delay={0.0}
            />
            <KPICard
              title="Available Vehicles"
              value={data.kpis.availableVehicles}
              subtext="Ready for dispatching"
              icon={ShieldCheck}
              delay={0.05}
            />
            <KPICard
              title="Fleet in Shop"
              value={data.kpis.inShopVehicles}
              subtext="Maintenance & Breakdowns"
              icon={Wrench}
              delay={0.1}
            />
            <KPICard
              title="Fleet Utilization"
              value={`${data.kpis.fleetUtilization}%`}
              subtext="Percentage of vehicles on trips"
              icon={TrendingUp}
              delay={0.15}
            />
            <KPICard
              title="Active Trips"
              value={data.kpis.activeTrips}
              subtext="Currently dispatched status"
              icon={MapPin}
              delay={0.2}
            />
            <KPICard
              title="Pending/Draft Trips"
              value={data.kpis.pendingTrips}
              subtext="Trips in scheduling backlog"
              icon={Clock}
              delay={0.25}
            />
            <KPICard
              title="Operators on Duty"
              value={data.kpis.driversOnDuty}
              subtext="Available + assigned drivers"
              icon={Users}
              delay={0.3}
            />
            <KPICard
              title="Total Fleet Revenue (7d)"
              value={`$${data.charts.trends.reduce((sum: number, t: any) => sum + t.revenue, 0).toLocaleString()}`}
              subtext="Accrued from active/completed trips"
              icon={Coins}
              delay={0.35}
            />
          </div>

          {/* 4. Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Revenue vs Expense Trend */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="glass-panel p-5 rounded-2xl border border-white/10"
            >
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Revenue vs Operating Cost Trend
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartThemeColors.grid} />
                    <XAxis dataKey="date" stroke={chartThemeColors.text} fontSize={10} tickLine={false} />
                    <YAxis stroke={chartThemeColors.text} fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartThemeColors.tooltipBg,
                        borderColor: chartThemeColors.tooltipBorder,
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Expenses ($)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Chart 2: Fleet Utilization Trend */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.45 }}
              className="glass-panel p-5 rounded-2xl border border-white/10"
            >
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Fleet Utilization Trend (%)
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.charts.trends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartThemeColors.grid} />
                    <XAxis dataKey="date" stroke={chartThemeColors.text} fontSize={10} tickLine={false} />
                    <YAxis stroke={chartThemeColors.text} fontSize={10} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartThemeColors.tooltipBg,
                        borderColor: chartThemeColors.tooltipBorder,
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                    <Line type="monotone" dataKey="utilization" name="Utilization Rate (%)" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Chart 3: Vehicle Status Distribution */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="glass-panel p-5 rounded-2xl border border-white/10"
            >
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Vehicle Status Distribution
              </h3>
              <div className="h-72 w-full flex flex-col md:flex-row items-center justify-around">
                {data.charts.statusDistribution.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-10 flex flex-col items-center">
                    <Ban className="h-8 w-8 mb-2" />
                    <span>No vehicles matching selected filters.</span>
                  </div>
                ) : (
                  <>
                    <div className="h-56 w-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.charts.statusDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {data.charts.statusDistribution.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: chartThemeColors.tooltipBg,
                              borderColor: chartThemeColors.tooltipBorder,
                              borderRadius: '0.75rem',
                              fontSize: '11px',
                              color: '#fff',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs shrink-0 max-w-[200px] w-full">
                      {data.charts.statusDistribution.map((entry: any, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: getStatusColor(entry.name) }}
                          />
                          <span className="text-slate-300 font-medium truncate">{entry.name}</span>
                          <span className="text-slate-500 font-bold">({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Chart 4: Trip Completion Rates */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.55 }}
              className="glass-panel p-5 rounded-2xl border border-white/10"
            >
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Trip Completion Metrics
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.tripCompletion} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartThemeColors.grid} />
                    <XAxis dataKey="name" stroke={chartThemeColors.text} fontSize={10} tickLine={false} />
                    <YAxis stroke={chartThemeColors.text} fontSize={10} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      contentStyle={{
                        backgroundColor: chartThemeColors.tooltipBg,
                        borderColor: chartThemeColors.tooltipBorder,
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                      {data.charts.tripCompletion.map((entry: any, index: number) => {
                        let barColor = '#8b5cf6'; // default Violet
                        if (entry.name === 'Completed') barColor = '#10b981';
                        if (entry.name === 'Cancelled') barColor = '#ef4444';
                        if (entry.name === 'Dispatched') barColor = '#3b82f6';
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* 5. Alerts Panel & Recent Activity split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Alerts Panel */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
              className="lg:col-span-1 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col h-[400px]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3 shrink-0">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                  <span>Operations Alerts</span>
                </h3>
                <span className="text-[10px] bg-amber-500/10 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  {data.alerts.length} Active
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {data.alerts.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-12 flex flex-col items-center">
                    <ShieldCheck className="h-8 w-8 text-emerald-400/80 mb-2" />
                    <span>No critical system alerts. Fleet is clear.</span>
                  </div>
                ) : (
                  data.alerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className={`p-3.5 border rounded-xl flex items-start space-x-3 text-xs leading-normal transition-all ${
                        alert.severity === 'red'
                          ? 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                          : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                          alert.severity === 'red' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                      />
                      <div className="space-y-0.5">
                        <div className="font-bold text-[11px] uppercase tracking-wide">
                          {alert.title}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal">
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Recent Activity Logs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.65 }}
              className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col h-[400px]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3 shrink-0">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <FileText className="h-4.5 w-4.5 text-primary" />
                  <span>Recent Fleet Activity</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {data.activity.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-12">
                    No recent activities recorded.
                  </div>
                ) : (
                  data.activity.map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between text-xs pb-3 border-b border-white/5 last:border-0"
                    >
                      <div className="space-y-0.5 min-w-0 pr-4">
                        <span className="font-semibold text-slate-200 block truncate">
                          {log.details}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center space-x-1 capitalize">
                          <span>By {log.user?.name || log.userEmail || 'System'}</span>
                          <span className="text-slate-600">•</span>
                          <span className="bg-white/5 px-1.5 py-0.5 rounded font-mono text-[9px]">
                            {log.action}
                          </span>
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 shrink-0 mt-0.5 font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
