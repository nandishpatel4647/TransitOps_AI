import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  ArrowUpDown,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Wrench,
  DollarSign,
  TrendingDown,
  Clock,
  Briefcase
} from 'lucide-react';

export default function MaintenanceList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  const isManager = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager' || user?.roleId === 'maintenance_manager';

  // Fetch Maintenance Records
  const { data, isLoading } = useQuery({
    queryKey: ['maintenanceRecords', search, status, type, sortBy, sortOrder, page],
    queryFn: async () => {
      const response = await api.get('/maintenance', {
        params: {
          search: search || undefined,
          status: status || undefined,
          type: type || undefined,
          sortBy,
          sortOrder,
          page,
          limit
        }
      });
      return response.data;
    }
  });

  // Delete maintenance record mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/maintenance/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceRecords'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Service Log Deleted', 'The maintenance schedule has been removed.');
    },
    onError: (err: any) => {
      toast('error', 'Deletion Failed', err.response?.data?.error || 'Failed to delete service log.');
    }
  });

  const handleDelete = (id: string, vehicleReg: string) => {
    if (window.confirm(`Are you sure you want to delete maintenance record for vehicle "${vehicleReg}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      case 'Scheduled':
        return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
      case 'In Progress':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'Completed':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Cancelled':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'Breakdown':
        return 'text-rose-400 bg-rose-500/10 border border-rose-500/25';
      case 'Corrective':
        return 'text-amber-400 bg-amber-500/10 border border-amber-500/25';
      default:
        return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25';
    }
  };

  // Compute total costs and counts from lists (visual counters)
  const activeTickets = data?.records.filter((r: any) => ['Pending', 'Scheduled', 'In Progress'].includes(r.status)).length || 0;
  const totalCostValue = data?.records.reduce((sum: number, r: any) => sum + r.cost + (r.labour || 0), 0) || 0;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span>Maintenance Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Schedule vehicle inspections, log repair services, and track lifecycle expenses.
          </p>
        </div>

        {isManager && (
          <button
            onClick={() => navigate('/maintenance/new')}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2 shrink-0"
          >
            <Plus size={15} />
            <span>Log Service</span>
          </button>
        )}
      </div>

      {/* KPI Stats widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Cost */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-400 shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Total Service Cost</span>
            <span className="text-sm font-extrabold text-white">${totalCostValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Active Tickets */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl text-blue-400 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Active Workshop Tickets</span>
            <span className="text-sm font-extrabold text-white">{activeTickets} Tickets</span>
          </div>
        </div>

        {/* Total records */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-violet-500/10 border border-violet-500/20 p-2.5 rounded-xl text-violet-400 shrink-0">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Service History</span>
            <span className="text-sm font-extrabold text-white">{(data?.pagination.total) || 0} Total Records</span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search vehicle, mechanic, workshop..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="Preventive">Preventive</option>
            <option value="Corrective">Corrective</option>
            <option value="Breakdown">Breakdown</option>
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
            <span>Loading service history...</span>
          </div>
        ) : !data || data.records.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
            <span>No service records found matching filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/15 bg-white/5 text-slate-400 font-semibold select-none">
                  <th className="p-4">Assigned Vehicle</th>
                  <th className="p-4">Service Type</th>
                  <th
                    onClick={() => handleSort('serviceDate')}
                    className="p-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Service Date</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Workshop</th>
                  <th className="p-4">Mechanic</th>
                  <th
                    onClick={() => handleSort('cost')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Service Cost</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Replaced Parts</th>
                  <th className="p-4 text-center">Status</th>
                  {isManager && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-white/5 text-slate-300 transition-colors">
                    <td className="p-4 font-bold text-white">
                      {r.vehicle ? (
                        <div>
                          <span className="bg-slate-900 border border-white/10 px-2 py-0.5 rounded text-[10px] text-white">
                            {r.vehicle.registrationNumber}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">{r.vehicle.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Deleted Vehicle</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTypeBadgeClass(r.type)}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-slate-400">
                      {new Date(r.serviceDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-slate-400">{r.workshop}</td>
                    <td className="p-4 text-slate-400">{r.mechanic}</td>
                    <td className="p-4 text-right font-extrabold text-white">
                      ${(r.cost + (r.labour || 0)).toLocaleString()}
                      <span className="text-[9px] text-slate-500 block font-normal">Cost: ${r.cost} + Lab: ${r.labour || 0}</span>
                    </td>
                    <td className="p-4 text-slate-400 max-w-[150px] truncate" title={r.parts || 'None'}>
                      {r.parts || <span className="text-slate-600 italic">None</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${getStatusBadgeClass(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    {isManager && (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => navigate(`/maintenance/edit/${r.id}`)}
                            className="p-1.5 hover:text-primary hover:bg-primary/10 text-slate-400 rounded-lg transition-all"
                            title="Edit Ticket"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.vehicle?.registrationNumber || 'unknown')}
                            className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 text-slate-400 rounded-lg transition-all"
                            title="Delete Ticket"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs bg-white/5">
            <span className="text-slate-500">
              Showing page <span className="font-semibold text-slate-300">{page}</span> of{' '}
              <span className="font-semibold text-slate-300">{data.pagination.totalPages}</span>
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 border border-white/10 hover:bg-white/5 rounded-lg disabled:opacity-40 transition-all text-slate-300"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="p-1.5 border border-white/10 hover:bg-white/5 rounded-lg disabled:opacity-40 transition-all text-slate-300"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
