import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  Wrench,
  Loader2,
  DollarSign,
  AlertTriangle,
  ArrowUpDown,
  TrendingDown,
  Info,
  ArrowLeft
} from 'lucide-react';

interface SummaryRecord {
  vehicleId: string;
  registrationNumber: string;
  name: string;
  odometer: number;
  fuelCost: number;
  maintenanceCost: number;
  otherCost: number;
  totalCost: number;
}

export default function VehicleCostSummary() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('totalCost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['expensesSummary'],
    queryFn: async () => {
      const response = await api.get('/expenses/summary');
      return response.data.summary as SummaryRecord[];
    }
  });

  const handleSort = (field: keyof SummaryRecord) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedSummary = data ? [...data].sort((a: any, b: any) => {
    const valA = a[sortBy];
    const valB = b[sortBy];
    if (typeof valA === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  }) : [];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/expenses')}
            className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all"
            title="Back to Expenses"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span>Vehicle Cost Summaries</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Consolidated operational costs per vehicle including fuel, scheduled repairs, and tolls.
            </p>
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-start space-x-2 text-xs text-slate-400 leading-normal">
        <Info className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
        <span>
          Operational cost aggregates fuel purchases, closed maintenance costs, and general expenses linked to specific vehicles. This cost mapping is utilized directly in calculations of <strong>Vehicle ROI</strong>.
        </span>
      </div>

      {/* Summary table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
            <span>Calculating vehicle cost balances...</span>
          </div>
        ) : sortedSummary.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
            <span>No fleet vehicle cost summary records.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/15 bg-white/5 text-slate-400 font-semibold select-none">
                  <th
                    onClick={() => handleSort('registrationNumber')}
                    className="p-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Vehicle Reg</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Name/Model</th>
                  <th
                    onClick={() => handleSort('odometer')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Odometer</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('fuelCost')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Fuel Cost</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('maintenanceCost')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Maintenance</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('otherCost')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Other Costs</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('totalCost')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Total Op Cost</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {sortedSummary.map((v) => (
                  <tr key={v.vehicleId} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-white">
                      <span className="bg-slate-900 border border-white/10 px-2 py-0.5 rounded text-[10px] text-white">
                        {v.registrationNumber}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-slate-400">{v.name}</td>
                    <td className="p-4 text-right font-mono">{v.odometer.toLocaleString()} mi</td>
                    <td className="p-4 text-right font-mono font-semibold text-amber-400">${v.fuelCost.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono font-semibold text-violet-400">${v.maintenanceCost.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono text-slate-400">${v.otherCost.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono font-extrabold text-white bg-white/[0.02]">
                      ${v.totalCost.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
