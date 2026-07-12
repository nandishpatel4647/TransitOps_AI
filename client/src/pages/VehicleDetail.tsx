import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Upload,
  Loader2,
  Wrench,
  TrendingDown,
  Gauge,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const isManager = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager';

  // Fetch Detail Data
  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicleDetail', id],
    queryFn: async () => {
      const response = await api.get(`/vehicles/${id}`);
      return response.data;
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', type);
      const response = await api.post(`/vehicles/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicleDetail', id] });
      toast('success', 'Document Uploaded', `The ${variables.type} document was uploaded successfully.`);
      setUploadingDoc(null);
    },
    onError: (err: any) => {
      toast('error', 'Upload Failed', err.response?.data?.error || 'Failed to upload document.');
      setUploadingDoc(null);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('error', 'File Too Large', 'Maximum document size allowed is 5MB.');
      return;
    }

    setUploadingDoc(type);
    uploadMutation.mutate({ type, file });
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span>Loading vehicle detailed insights...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 text-center max-w-md">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <h2 className="text-sm font-bold text-white mb-2">Record Not Found</h2>
          <p className="text-xs text-slate-400 mb-4">
            The vehicle profile may have been deleted or does not exist.
          </p>
          <button
            onClick={() => navigate('/vehicles')}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  const { vehicle, analytics } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'On Trip': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'In Shop':
      case 'Breakdown': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'Retired': return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const documentTypes = [
    { label: 'Insurance Policy', type: 'insurance', url: vehicle.insuranceUrl },
    { label: 'Pollution Under Control (PUC)', type: 'puc', url: vehicle.pucUrl },
    { label: 'Fitness Certificate', type: 'fitnessCert', url: vehicle.fitnessCertUrl },
    { label: 'Road Permit', type: 'permit', url: vehicle.permitUrl }
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/vehicles')}
            className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-white tracking-tight">{vehicle.registrationNumber}</h1>
              <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${getStatusColor(vehicle.status)}`}>
                {vehicle.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{vehicle.manufacturer} {vehicle.name} ({vehicle.year})</p>
          </div>
        </div>
      </div>

      {/* KPI stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cost */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Purchase Price</span>
            <span className="text-sm font-extrabold text-white">${vehicle.acquisitionCost.toLocaleString()}</span>
          </div>
        </div>

        {/* Current Depreciation Value */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-violet-500/10 border border-violet-500/20 p-2.5 rounded-xl text-violet-400">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Computed Value</span>
            <span className="text-sm font-extrabold text-white">${analytics.currentValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Odometer */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-primary">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Odometer</span>
            <span className="text-sm font-extrabold text-white">{vehicle.odometer.toLocaleString()} mi</span>
          </div>
        </div>

        {/* Life age */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center space-x-4">
          <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Vehicle Age</span>
            <span className="text-sm font-extrabold text-white">{analytics.ageYears} Years Old</span>
          </div>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specs & Documents (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Specifications */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Specifications</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Manufacturer</span>
                <p className="text-white font-semibold">{vehicle.manufacturer}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Model / Name</span>
                <p className="text-white font-semibold">{vehicle.name}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Vehicle Type</span>
                <p className="text-white font-semibold">{vehicle.type}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Fuel Type</span>
                <p className="text-white font-semibold">{vehicle.fuelType}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Load Capacity</span>
                <p className="text-white font-semibold">{vehicle.loadCapacity.toLocaleString()} kg</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Region Scope</span>
                <p className="text-white font-semibold capitalize">{vehicle.region}</p>
              </div>
            </div>
          </div>

          {/* Odometer history logs */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Odometer Timeline</h3>
            <div className="h-56 w-full">
              {analytics.odometerHistory.length <= 1 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Odometer log tracking will populate as fuel logs are submitted.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.odometerHistory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} domain={['dataMin - 1000', 'dataMax + 1000']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.75rem',
                        fontSize: '10px',
                        color: '#fff',
                      }}
                    />
                    <Line type="monotone" dataKey="odometer" name="Odometer (mi)" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Documents Panel (1 Col) */}
        <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col h-fit">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-3 border-b border-white/5">
            Compliance & Permits
          </h3>
          <div className="space-y-4">
            {documentTypes.map((doc, idx) => (
              <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{doc.label}</span>
                  <span className={`px-2 py-0.5 border rounded-md text-[8px] font-bold uppercase tracking-wider ${
                    doc.url
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                  }`}>
                    {doc.url ? 'Uploaded' : 'Missing'}
                  </span>
                </div>

                {doc.url ? (
                  <a
                    href={`${doc.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center space-x-1.5 bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:text-white"
                  >
                    <ExternalLink size={12} />
                    <span>View Document</span>
                  </a>
                ) : (
                  <div className="text-[10px] text-slate-500 flex items-center space-x-1 justify-center py-1 border border-dashed border-white/10 rounded-lg">
                    <span>No file available.</span>
                  </div>
                )}

                {isManager && (
                  <div className="relative">
                    <input
                      type="file"
                      id={`file-${doc.type}`}
                      onChange={(e) => handleFileChange(e, doc.type)}
                      accept=".pdf,image/*"
                      className="hidden"
                      disabled={uploadingDoc === doc.type}
                    />
                    <label
                      htmlFor={`file-${doc.type}`}
                      className="w-full flex items-center justify-center space-x-1.5 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                    >
                      {uploadingDoc === doc.type ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={12} />
                          <span>Upload File</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
