import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid
} from 'recharts';
import {
  BarChart3,
  DollarSign,
  Loader2,
  TrendingDown,
  Download,
  AlertTriangle,
  ArrowUpDown,
  Gauge,
  Wallet
} from 'lucide-react';

interface VehiclePerformance {
  vehicleId: string;
  registrationNumber: string;
  name: string;
  type: string;
  acquisitionCost: number;
  revenue: number;
  fuelCost: number;
  maintenanceCost: number;
  otherCost: number;
  totalExpense: number;
  netProfit: number;
  roi: number;
  fuelEfficiency: number;
  completedDistance: number;
}

interface CostDistribution {
  name: string;
  value: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b', '#06b6d4'];

export default function ReportsAnalytics() {
  const [sortBy, setSortBy] = useState<'roi' | 'revenue' | 'netProfit' | 'totalExpense'>('roi');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch report analytics dataset
  const { data, isLoading } = useQuery({
    queryKey: ['reportAnalytics'],
    queryFn: async () => {
      const response = await api.get('/reports/analytics');
      return response.data;
    }
  });

  const handleSort = (field: 'roi' | 'revenue' | 'netProfit' | 'totalExpense') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedPerformance = data?.vehiclePerformance 
    ? [...data.vehiclePerformance].sort((a: any, b: any) => {
        return sortOrder === 'asc' ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
      }) 
    : [];

  const handleCSVExport = () => {
    if (!data || !data.vehiclePerformance) return;

    const headers = [
      'Registration Number',
      'Vehicle Name',
      'Acquisition Cost ($)',
      'Total Revenue ($)',
      'Fuel Expense ($)',
      'Maintenance Expense ($)',
      'Other Expense ($)',
      'Total Expenses ($)',
      'Net Profit ($)',
      'Odometer Distance (mi)',
      'Fuel Efficiency (mpg)',
      'ROI (%)'
    ];

    const rows = data.vehiclePerformance.map((v: VehiclePerformance) => [
      v.registrationNumber,
      v.name,
      v.acquisitionCost,
      v.revenue,
      v.fuelCost,
      v.maintenanceCost,
      v.otherCost,
      v.totalExpense,
      v.netProfit,
      v.completedDistance,
      v.fuelEfficiency.toFixed(2),
      v.roi.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TransitOps_ROI_Report_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRoiBadgeClass = (roi: number) => {
    if (roi >= 20) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
    if (roi >= 5) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Reports & Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Perform deep-dive financial audits on vehicle ROIs, fuel efficiencies, and cost allocations.
          </p>
        </div>

        {data && (
          <button
            onClick={handleCSVExport}
            className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2 shrink-0"
          >
            <Download size={14} />
            <span>Export ROI Sheet (CSV)</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span>Compiling report analytics...</span>
          </div>
        </div>
      ) : !data ? (
        <div className="glass-panel p-12 text-center border border-white/10 text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
          <span>Failed to compile reporting telemetry. Ensure mock seeds are active.</span>
        </div>
      ) : (
        <>
          {/* Summary widgets cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Revenue */}
            <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-400 shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Fleet Total Revenue</span>
                <span className="text-sm font-extrabold text-white">${data.summary.totalRevenue.toLocaleString()}</span>
              </div>
            </div>

            {/* Total Expense */}
            <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
              <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-rose-400 shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Fleet Total Expenditures</span>
                <span className="text-sm font-extrabold text-white">${data.summary.totalExpense.toLocaleString()}</span>
              </div>
            </div>

            {/* Net profit */}
            <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
              <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl text-blue-400 shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Operating Cash Flow</span>
                <span className={`text-sm font-extrabold ${data.summary.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${data.summary.totalNetProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost distribution Pie chart */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col h-[320px]">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Operational Costs Allocation</h3>
              <div className="flex-1 min-h-0 relative">
                {data.costDistribution.length === 0 ? (
                  <div className="text-[10px] text-slate-500 text-center py-20 italic">No operational expense allocation data logged yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.costDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.costDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0b1329', borderColor: '#1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff', fontSize: '10px' }}
                        formatter={(value: any) => [`$${value.toLocaleString()}`, 'Total Cost']}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Fuel Efficiency Bar chart */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col h-[320px]">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Vehicle Fuel Efficiency (mpg)</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.vehiclePerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
                    <XAxis dataKey="registrationNumber" stroke="#94a3b8" fontSize={9} />
                    <YAxis stroke="#94a3b8" fontSize={9} label={{ value: 'Miles / Gallon', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0b1329', borderColor: '#1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontSize: '10px' }}
                      formatter={(value: any) => [`${value.toFixed(2)} mpg`, 'Fuel Efficiency']}
                    />
                    <Bar dataKey="fuelEfficiency" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Vehicle performance ROI Table */}
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle Performance & ROI Audit</h3>
              <span className="text-[10px] text-slate-500 font-medium">ROI = (Revenue − (Maintenance + Fuel)) ÷ Acquisition Cost</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/15 bg-white/5 text-slate-400 font-semibold select-none">
                    <th className="p-4">Vehicle Reg</th>
                    <th className="p-4">Model/Name</th>
                    <th className="p-4 text-right">Acquisition Cost</th>
                    <th
                      onClick={() => handleSort('revenue')}
                      className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                    >
                      <div className="flex items-center justify-end space-x-1.5">
                        <span>Total Revenue</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="p-4 text-right font-medium text-amber-500/80">Fuel Costs</th>
                    <th className="p-4 text-right font-medium text-violet-500/80">Maint. Costs</th>
                    <th
                      onClick={() => handleSort('totalExpense')}
                      className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                    >
                      <div className="flex items-center justify-end space-x-1.5">
                        <span>Total Expense</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('netProfit')}
                      className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                    >
                      <div className="flex items-center justify-end space-x-1.5">
                        <span>Net Profit</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('roi')}
                      className="p-4 cursor-pointer hover:text-white transition-colors text-center"
                    >
                      <div className="flex items-center justify-center space-x-1.5">
                        <span>Computed ROI</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {sortedPerformance.map((v: VehiclePerformance) => (
                    <tr key={v.vehicleId} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">
                        <span className="bg-slate-900 border border-white/10 px-2 py-0.5 rounded text-[10px] text-white">
                          {v.registrationNumber}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-400">{v.name}</td>
                      <td className="p-4 text-right font-mono">${v.acquisitionCost.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-400">${v.revenue.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono font-semibold text-amber-400">${v.fuelCost.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono font-semibold text-violet-400">${v.maintenanceCost.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-slate-400">${v.totalExpense.toLocaleString()}</td>
                      <td className={`p-4 text-right font-mono font-extrabold ${v.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${v.netProfit.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${getRoiBadgeClass(v.roi)}`}>
                          {v.roi.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
