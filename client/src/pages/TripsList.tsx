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
  Eye,
  ChevronLeft,
  ChevronRight,
  MapPin,
  AlertTriangle,
  Compass,
  ArrowRight
} from 'lucide-react';

export default function TripsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  const isDispatcher = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager' || user?.roleId === 'dispatcher';

  // Fetch Trips
  const { data, isLoading } = useQuery({
    queryKey: ['trips', search, status, priority, sortBy, sortOrder, page],
    queryFn: async () => {
      const response = await api.get('/trips', {
        params: {
          search: search || undefined,
          status: status || undefined,
          priority: priority || undefined,
          sortBy,
          sortOrder,
          page,
          limit
        }
      });
      return response.data;
    }
  });

  // Delete trip mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/trips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast('success', 'Trip Deleted', 'The trip schedule has been successfully removed.');
    },
    onError: (err: any) => {
      toast('error', 'Deletion Failed', err.response?.data?.error || 'Failed to delete trip.');
    }
  });

  const handleDelete = (id: string, route: string) => {
    if (window.confirm(`Are you sure you want to delete trip "${route}"?`)) {
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
      case 'Draft':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      case 'Approved':
        return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
      case 'Dispatched':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'Completed':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Cancelled':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-white/5';
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-primary" />
            <span>Trip Dispatch Logs</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch vehicles, monitor deliveries, and review operational trip histories.
          </p>
        </div>

        {isDispatcher && (
          <button
            onClick={() => navigate('/trips/new')}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2 shrink-0"
          >
            <Plus size={15} />
            <span>Book Trip</span>
          </button>
        )}
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
            placeholder="Search customer, location, cargo..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Priority */}
          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Dispatched">Dispatched</option>
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
            <span>Loading dispatch logs...</span>
          </div>
        ) : !data || data.trips.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
            <span>No trips scheduled matching current filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/15 bg-white/5 text-slate-400 font-semibold select-none">
                  <th className="p-4">Route Location</th>
                  <th
                    onClick={() => handleSort('customer')}
                    className="p-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Customer</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Cargo Details</th>
                  <th className="p-4">Assigned Vehicle</th>
                  <th className="p-4">Assigned Driver</th>
                  <th
                    onClick={() => handleSort('revenue')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Revenue ($)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Priority</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.trips.map((t: any) => {
                  const routeName = `${t.source} -> ${t.destination}`;
                  return (
                    <tr key={t.id} className="hover:bg-white/5 text-slate-300 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white flex items-center space-x-1">
                          <span>{t.source}</span>
                          <ArrowRight size={10} className="text-slate-500" />
                          <span>{t.destination}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Est. {t.plannedDistance} miles</div>
                      </td>
                      <td className="p-4 font-semibold text-slate-200">{t.customer}</td>
                      <td className="p-4">
                        <div className="font-medium">{t.cargoType}</div>
                        <div className="text-[10px] text-slate-500">{t.cargoWeight.toLocaleString()} kg load</div>
                      </td>
                      <td className="p-4">
                        {t.assignedVehicle ? (
                          <div>
                            <span className="bg-slate-900 border border-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                              {t.assignedVehicle.registrationNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-1">{t.assignedVehicle.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4">
                        {t.assignedDriver ? (
                          <div>
                            <span className="font-semibold">{t.assignedDriver.name}</span>
                            <span className="text-[10px] text-slate-500 block">Lic: {t.assignedDriver.licenseNumber}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-400">
                        ${t.revenue.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getPriorityBadgeClass(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${getStatusBadgeClass(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => navigate(`/trips/${t.id}`)}
                            className="p-1.5 hover:text-white hover:bg-white/5 text-slate-400 rounded-lg transition-all"
                            title="View Dispatch Details"
                          >
                            <Eye size={14} />
                          </button>
                          {isDispatcher && (t.status === 'Draft' || t.status === 'Approved') && (
                            <>
                              <button
                                onClick={() => navigate(`/trips/edit/${t.id}`)}
                                className="p-1.5 hover:text-primary hover:bg-primary/10 text-slate-400 rounded-lg transition-all"
                                title="Edit Trip Schedule"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(t.id, routeName)}
                                className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 text-slate-400 rounded-lg transition-all"
                                title="Cancel/Delete Trip"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
