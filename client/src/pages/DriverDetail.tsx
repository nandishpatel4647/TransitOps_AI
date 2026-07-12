import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Upload,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Phone,
  Contact,
  Award,
  Compass
} from 'lucide-react';

export default function DriverDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [uploadingLicense, setUploadingLicense] = useState(false);

  const isManager = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager';

  // Fetch driver detail
  const { data, isLoading, error } = useQuery({
    queryKey: ['driverDetail', id],
    queryFn: async () => {
      const response = await api.get(`/drivers/${id}`);
      return response.data;
    }
  });

  // License upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('license', file);
      const response = await api.post(`/drivers/${id}/license`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverDetail', id] });
      toast('success', 'License Uploaded', 'Driver commercial license document has been saved.');
      setUploadingLicense(false);
    },
    onError: (err: any) => {
      toast('error', 'Upload Failed', err.response?.data?.error || 'Failed to upload license document.');
      setUploadingLicense(false);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('error', 'File Too Large', 'Maximum file size allowed is 5MB.');
      return;
    }

    setUploadingLicense(true);
    uploadMutation.mutate(file);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span>Loading operator profile data...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 text-center max-w-md">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <h2 className="text-sm font-bold text-white mb-2">Driver Profile Not Found</h2>
          <p className="text-xs text-slate-400 mb-4">
            The profile record does not exist or has been removed from inventory.
          </p>
          <button
            onClick={() => navigate('/drivers')}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
          >
            Back to Profiles
          </button>
        </div>
      </div>
    );
  }

  const { driver, trips } = data;
  const isExpired = new Date(driver.licenseExpiryDate) < new Date();

  const getStatusColor = (status: string) => {
    if (isExpired) return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    switch (status) {
      case 'Available': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'On Trip': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'Off Duty': return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      case 'Suspended': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'Leave': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
    if (score >= 80) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
  };

  const getTripStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Dispatched': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'Cancelled': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/drivers')}
            className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-white tracking-tight">{driver.name}</h1>
              <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${getStatusColor(driver.status)}`}>
                {isExpired ? 'EXPIRED / SUSPENDED' : driver.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Commercial Operator (ID: {driver.id.substring(0, 8)})</p>
          </div>
        </div>
      </div>

      {/* KPI stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Safety gauge */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className={`p-2.5 rounded-xl shrink-0 ${getSafetyColor(driver.safetyScore)}`}>
            <Award className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Safety Rating</span>
            <span className="text-sm font-extrabold text-white">{driver.safetyScore.toFixed(1)}%</span>
          </div>
        </div>

        {/* License category */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-violet-500/10 border border-violet-500/20 p-2.5 rounded-xl text-violet-400 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Classification</span>
            <span className="text-sm font-extrabold text-white truncate max-w-[150px] block">{driver.licenseCategory}</span>
          </div>
        </div>

        {/* Expiry Date */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className={`p-2.5 rounded-xl shrink-0 ${isExpired ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider font-semibold">License Expiry</span>
            <span className={`text-sm font-extrabold block ${isExpired ? 'text-rose-400 font-black' : 'text-white'}`}>
              {new Date(driver.licenseExpiryDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Trips count */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-400 shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Assigned Trips</span>
            <span className="text-sm font-extrabold text-white">{trips.length} Lifetime Trips</span>
          </div>
        </div>
      </div>

      {/* Main layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Operator Details */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Contact className="h-4 w-4" />
              <span>Operator Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-medium block">License Number</span>
                <p className="text-white font-semibold text-sm">{driver.licenseNumber}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-medium block">Contact Number</span>
                <p className="text-white font-semibold text-sm flex items-center space-x-1.5">
                  <Phone size={12} className="text-slate-500" />
                  <span>{driver.contactNumber}</span>
                </p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <span className="text-slate-500 font-medium block">Emergency Contact Name & Phone</span>
                <p className="text-white font-semibold text-sm flex items-center space-x-1.5">
                  <Phone size={12} className="text-slate-500" />
                  <span>{driver.emergencyContact}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Driving History */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Driving Trip Logs</h3>
            
            {trips.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-10">
                No trip records associated with this driver.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-500 font-semibold select-none">
                      <th className="pb-3">Trip Route</th>
                      <th className="pb-3">Vehicle</th>
                      <th className="pb-3 text-right">Distance (mi)</th>
                      <th className="pb-3 text-right">Revenue ($)</th>
                      <th className="pb-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {trips.map((t: any) => (
                      <tr key={t.id} className="hover:bg-white/5 text-slate-300">
                        <td className="py-3">
                          <div className="font-semibold text-white">{t.source}</div>
                          <div className="text-[10px] text-slate-500">to {t.destination}</div>
                        </td>
                        <td className="py-3">
                          {t.assignedVehicle ? (
                            <span className="bg-slate-900 border border-white/10 text-[10px] font-bold px-2 py-0.5 rounded text-slate-300">
                              {t.assignedVehicle.registrationNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px] italic">Not assigned</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-medium">{t.actualDistance || t.plannedDistance}</td>
                        <td className="py-3 text-right font-medium">${t.revenue.toLocaleString()}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 border rounded-full text-[8px] font-bold uppercase tracking-wider ${getTripStatusColor(t.status)}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* License Upload card */}
        <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col h-fit">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-3 border-b border-white/5">
            Driver Compliance
          </h3>

          <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">CDL License Document</span>
              <span className={`px-2 py-0.5 border rounded-md text-[8px] font-bold uppercase tracking-wider ${
                driver.licenseUrl
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
              }`}>
                {driver.licenseUrl ? 'Uploaded' : 'Missing'}
              </span>
            </div>

            {driver.licenseUrl ? (
              <a
                href={`${driver.licenseUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-1.5 bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 py-2 rounded-lg text-[10px] font-semibold transition-all hover:text-white"
              >
                <ExternalLink size={12} />
                <span>View License Doc</span>
              </a>
            ) : (
              <div className="text-[10px] text-slate-500 flex items-center space-x-1 justify-center py-2.5 border border-dashed border-white/10 rounded-lg">
                <span>No compliance file uploaded.</span>
              </div>
            )}

            {isExpired && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] leading-relaxed flex items-start space-x-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>CRITICAL:</strong> License expired. Driver is suspended from assignments until renewal.
                </span>
              </div>
            )}

            {isManager && (
              <div className="relative">
                <input
                  type="file"
                  id="driver-license-upload"
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                  className="hidden"
                  disabled={uploadingLicense}
                />
                <label
                  htmlFor="driver-license-upload"
                  className="w-full flex items-center justify-center space-x-1.5 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                >
                  {uploadingLicense ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving File...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={12} />
                      <span>Upload CDL file</span>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
