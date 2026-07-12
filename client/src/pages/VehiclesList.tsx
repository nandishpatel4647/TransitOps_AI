import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  Edit2,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Truck,
  AlertTriangle
} from 'lucide-react';

export default function VehiclesList() {
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

  const isManager = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager';

  // Fetch Vehicles
  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', search, status, type, sortBy, sortOrder, page],
    queryFn: async () => {
      const response = await api.get('/vehicles', {
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

  // Delete vehicle mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/vehicles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast('success', 'Vehicle Deleted', 'The vehicle record has been permanently deleted.');
    },
    onError: (err: any) => {
      toast('error', 'Deletion Failed', err.response?.data?.error || 'Failed to delete vehicle.');
    }
  });

  const handleDelete = (id: string, reg: string) => {
    if (window.confirm(`Are you sure you want to permanently delete vehicle "${reg}"?`)) {
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
      case 'Available':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'On Trip':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'In Shop':
      case 'Breakdown':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'Reserved':
        return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
      case 'Retired':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Truck className="h-5 w-5 text-primary" />
            <span>Vehicle Inventory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and manage all fleet transport vehicles in active inventory.
          </p>
        </div>

        {isManager && (
          <button
            onClick={() => navigate('/vehicles/new')}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2 shrink-0"
          >
            <Plus size={15} />
            <span>Add Vehicle</span>
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
            placeholder="Search registration or name..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Type */}
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="Cargo Van">Cargo Van</option>
            <option value="Semi-Truck">Semi-Truck</option>
            <option value="Truck">Box Truck</option>
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
            <option value="Available">Available</option>
            <option value="On Trip">On Trip</option>
            <option value="In Shop">In Shop</option>
            <option value="Breakdown">Breakdown</option>
            <option value="Reserved">Reserved</option>
            <option value="Retired">Retired</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
            <span>Loading vehicles dataset...</span>
          </div>
        ) : !data || data.vehicles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
            <span>No vehicles found matching current search filters.</span>
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
                      <span>Registration</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="p-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Model / Manufacturer</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Type</th>
                  <th
                    onClick={() => handleSort('loadCapacity')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Capacity (kg)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('odometer')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1.5">
                      <span>Odometer (mi)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Region</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.vehicles.map((v: any) => (
                  <tr key={v.id} className="hover:bg-white/5 text-slate-300 transition-colors">
                    <td className="p-4 font-bold text-white tracking-wide">
                      {v.registrationNumber}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-[10px] text-slate-500">{v.manufacturer} ({v.year})</div>
                    </td>
                    <td className="p-4 text-slate-400">{v.type}</td>
                    <td className="p-4 text-right font-medium">{v.loadCapacity.toLocaleString()}</td>
                    <td className="p-4 text-right font-medium">{v.odometer.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${getStatusBadgeClass(v.status)}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 capitalize">{v.region}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => navigate(`/vehicles/${v.id}`)}
                          className="p-1.5 hover:text-white hover:bg-white/5 text-slate-400 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        {isManager && (
                          <>
                            <button
                              onClick={() => navigate(`/vehicles/edit/${v.id}`)}
                              className="p-1.5 hover:text-primary hover:bg-primary/10 text-slate-400 rounded-lg transition-all"
                              title="Edit Vehicle"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(v.id, v.registrationNumber)}
                              className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 text-slate-400 rounded-lg transition-all"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
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
