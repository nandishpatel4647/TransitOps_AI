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
  Users,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function DriversList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  const isManager = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager';

  // Fetch Drivers
  const { data, isLoading } = useQuery({
    queryKey: ['drivers', search, status, sortBy, sortOrder, page],
    queryFn: async () => {
      const response = await api.get('/drivers', {
        params: {
          search: search || undefined,
          status: status || undefined,
          sortBy,
          sortOrder,
          page,
          limit
        }
      });
      return response.data;
    }
  });

  // Delete driver mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/drivers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast('success', 'Driver Deleted', 'The driver profile has been permanently removed.');
    },
    onError: (err: any) => {
      toast('error', 'Deletion Failed', err.response?.data?.error || 'Failed to delete driver.');
    }
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently delete driver "${name}"?`)) {
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

  const getStatusBadgeClass = (driver: any) => {
    const isExpired = new Date(driver.licenseExpiryDate) < new Date();
    if (isExpired) {
      return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    }

    switch (driver.status) {
      case 'Available':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'On Trip':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'Off Duty':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      case 'Suspended':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'Leave':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getSafetyBadgeClass = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25';
    if (score >= 80) return 'text-amber-400 bg-amber-500/10 border border-amber-500/25';
    return 'text-rose-400 bg-rose-500/10 border border-rose-500/25';
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Driver Profiles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage commercial operators, licenses, safety standings, and availabilities.
          </p>
        </div>

        {isManager && (
          <button
            onClick={() => navigate('/drivers/new')}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2 shrink-0"
          >
            <Plus size={15} />
            <span>Register Driver</span>
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
            placeholder="Search name, license, contact..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
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
            <option value="Off Duty">Off Duty</option>
            <option value="Suspended">Suspended</option>
            <option value="Leave">Leave</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
            <span>Loading drivers dataset...</span>
          </div>
        ) : !data || data.drivers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
            <span>No driver profiles found matching current filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/15 bg-white/5 text-slate-400 font-semibold select-none">
                  <th
                    onClick={() => handleSort('name')}
                    className="p-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Operator Name</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('licenseNumber')}
                    className="p-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>License Number</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">License Category</th>
                  <th
                    onClick={() => handleSort('licenseExpiryDate')}
                    className="p-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>License Expiry</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Contact Number</th>
                  <th
                    onClick={() => handleSort('safetyScore')}
                    className="p-4 cursor-pointer hover:text-white transition-colors text-center"
                  >
                    <div className="flex items-center justify-center space-x-1.5">
                      <span>Safety Rating</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.drivers.map((d: any) => {
                  const isExpired = new Date(d.licenseExpiryDate) < new Date();
                  return (
                    <tr key={d.id} className="hover:bg-white/5 text-slate-300 transition-colors">
                      <td className="p-4 font-bold text-white tracking-wide">
                        {d.name}
                      </td>
                      <td className="p-4 font-semibold text-slate-400">
                        {d.licenseNumber}
                      </td>
                      <td className="p-4 text-slate-400">{d.licenseCategory}</td>
                      <td className={`p-4 font-medium ${isExpired ? 'text-rose-400 font-bold' : ''}`}>
                        {new Date(d.licenseExpiryDate).toLocaleDateString()}
                        {isExpired && (
                          <span className="ml-2 px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/25 rounded text-[8px] font-bold text-rose-400">
                            EXPIRED
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400">{d.contactNumber}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${getSafetyBadgeClass(d.safetyScore)}`}>
                          {d.safetyScore.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${getStatusBadgeClass(d)}`}>
                          {isExpired ? 'Suspended' : d.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => navigate(`/drivers/${d.id}`)}
                            className="p-1.5 hover:text-white hover:bg-white/5 text-slate-400 rounded-lg transition-all"
                            title="View Profile Details"
                          >
                            <Eye size={14} />
                          </button>
                          {isManager && (
                            <>
                              <button
                                onClick={() => navigate(`/drivers/edit/${d.id}`)}
                                className="p-1.5 hover:text-primary hover:bg-primary/10 text-slate-400 rounded-lg transition-all"
                                title="Edit Profile"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(d.id, d.name)}
                                className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 text-slate-400 rounded-lg transition-all"
                                title="Delete Profile"
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
