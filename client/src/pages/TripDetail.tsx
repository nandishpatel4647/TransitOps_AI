import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  User,
  Compass,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Play
} from 'lucide-react';

const completionSchema = z.object({
  actualDistance: z.coerce.number().positive('Actual distance must be positive'),
  fuelConsumed: z.coerce.number().positive('Fuel consumed must be positive'),
  finalOdometer: z.coerce.number().positive('Final odometer must be positive'),
});

type CompletionFormValues = z.infer<typeof completionSchema>;

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isDispatcher = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager' || user?.roleId === 'dispatcher';

  // Fetch Trip Details & Timeline logs
  const { data, isLoading, error } = useQuery({
    queryKey: ['tripDetail', id],
    queryFn: async () => {
      const response = await api.get(`/trips/${id}`);
      return response.data;
    }
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CompletionFormValues>({
    resolver: zodResolver(completionSchema)
  });

  // Action Mutations
  const approveMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/trips/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDetail', id] });
      toast('success', 'Trip Approved', 'The trip schedule has been advanced to Approved status.');
    },
    onError: (err: any) => {
      toast('error', 'Action Failed', err.response?.data?.error || 'Failed to approve trip.');
    }
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/trips/${id}/dispatch`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDetail', id] });
      toast('success', 'Trip Dispatched', 'Trip dispatched successfully! Vehicle and driver set to On Trip.');
    },
    onError: (err: any) => {
      toast('error', 'Dispatch Failed', err.response?.data?.error || 'Failed to dispatch trip.');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/trips/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDetail', id] });
      toast('success', 'Trip Cancelled', 'The trip has been cancelled. Vehicle and driver released.');
    },
    onError: (err: any) => {
      toast('error', 'Action Failed', err.response?.data?.error || 'Failed to cancel trip.');
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (formData: CompletionFormValues) => {
      await api.post(`/trips/${id}/complete`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Trip Completed', 'Trip completed successfully! Vehicle odometer updated, fuel logs recorded.');
      setCompleteModalOpen(false);
      reset();
      setLocalError(null);
    },
    onError: (err: any) => {
      setLocalError(err.response?.data?.error || 'Failed to complete trip.');
    }
  });

  const onCompleteSubmit = (data: CompletionFormValues) => {
    setLocalError(null);
    completeMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span>Loading trip scheduling logs...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 text-center max-w-md">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <h2 className="text-sm font-bold text-white mb-2">Trip Not Found</h2>
          <p className="text-xs text-slate-400 mb-4">
            The trip profile may have been cancelled, deleted, or does not exist.
          </p>
          <button
            onClick={() => navigate('/trips')}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
          >
            Back to Dispatch Board
          </button>
        </div>
      </div>
    );
  }

  const { trip, timeline } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      case 'Approved': return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
      case 'Dispatched': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'Completed': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Cancelled': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  // Helper to parse logs for timestamps
  const getTimelineLog = (action: string) => {
    return timeline.find((log: any) => log.action === action);
  };

  const logCreated = getTimelineLog('CREATE_TRIP');
  const logApproved = getTimelineLog('APPROVE_TRIP');
  const logDispatched = getTimelineLog('DISPATCH_TRIP');
  const logCompleted = getTimelineLog('COMPLETE_TRIP');
  const logCancelled = getTimelineLog('CANCEL_TRIP');

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/trips')}
            className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-1.5">
                <span>{trip.source}</span>
                <ArrowRight size={14} className="text-slate-500" />
                <span>{trip.destination}</span>
              </h1>
              <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${getStatusColor(trip.status)}`}>
                {trip.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Booked Customer: {trip.customer} • Est: {trip.plannedDistance} miles</p>
          </div>
        </div>

        {/* Action Dashboard Controls */}
        {isDispatcher && (
          <div className="flex items-center gap-2">
            {trip.status === 'Draft' && (
              <>
                <button
                  onClick={() => approveMutation.mutate()}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_12px_rgba(139,92,246,0.2)] flex items-center space-x-1.5"
                >
                  <ShieldCheck size={14} />
                  <span>Approve Trip</span>
                </button>
                <button
                  onClick={() => navigate(`/trips/edit/${trip.id}`)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                >
                  Edit Schedule
                </button>
              </>
            )}

            {trip.status === 'Approved' && (
              <>
                <button
                  onClick={() => dispatchMutation.mutate()}
                  className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)] flex items-center space-x-1.5 animate-pulse"
                >
                  <Play size={12} fill="currentColor" />
                  <span>Dispatch Trip</span>
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                >
                  Cancel Trip
                </button>
              </>
            )}

            {trip.status === 'Dispatched' && (
              <>
                <button
                  onClick={() => setCompleteModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_12px_rgba(16,185,129,0.2)] flex items-center space-x-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Complete Trip</span>
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                >
                  Cancel Trip
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (2 Columns): Profile details and Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trip profile details */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Compass className="h-4 w-4 text-primary" />
              <span>Manifest Information</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Customer Account</span>
                <p className="text-white font-bold text-sm mt-0.5">{trip.customer}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Cargo Category</span>
                <p className="text-white font-semibold text-sm mt-0.5">{trip.cargoType}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Cargo weight</span>
                <p className="text-white font-semibold text-sm mt-0.5">{trip.cargoWeight.toLocaleString()} kg</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Revenue</span>
                <p className="text-emerald-400 font-bold text-sm mt-0.5">${trip.revenue.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Planned Distance</span>
                <p className="text-white font-semibold text-sm mt-0.5">{trip.plannedDistance} miles</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Priority</span>
                <p className="text-white font-semibold text-sm mt-0.5">{trip.priority}</p>
              </div>

              {trip.status === 'Completed' && (
                <>
                  <div className="border-t border-white/10 pt-4 col-span-2 sm:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <div>
                      <span className="text-slate-500 font-medium">Actual Distance</span>
                      <p className="text-white font-bold text-sm mt-0.5">{trip.actualDistance} miles</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Fuel Consumed</span>
                      <p className="text-amber-400 font-bold text-sm mt-0.5">{trip.fuelConsumed} gal</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Fuel Efficiency</span>
                      <p className="text-emerald-400 font-bold text-sm mt-0.5">
                        {trip.actualDistance && trip.fuelConsumed
                          ? (trip.actualDistance / trip.fuelConsumed).toFixed(2)
                          : 0}{' '}
                        mpg
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {trip.notes && (
              <div className="mt-5 p-3.5 bg-white/5 border border-white/5 rounded-xl text-xs">
                <span className="text-slate-400 font-bold block mb-1">Operational Dispatch Notes</span>
                <p className="text-slate-300 leading-relaxed">{trip.notes}</p>
              </div>
            )}
          </div>

          {/* Timeline component */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Trip Timeline Tracker</h3>
            
            <div className="relative pl-6 border-l border-white/10 space-y-8 ml-3 text-xs">
              {/* Point 1: Created */}
              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 bg-slate-900 p-0.5 rounded-full">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold text-white block">Trip Created (Draft)</span>
                  <span className="text-[10px] text-slate-400 block">
                    {logCreated 
                      ? `By ${logCreated.user?.name || logCreated.userEmail || 'System'} on ${new Date(logCreated.timestamp).toLocaleString()}`
                      : `Created on ${new Date(trip.createdAt).toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* Point 2: Approved */}
              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 bg-slate-900 p-0.5 rounded-full">
                  {logApproved ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                  ) : logCancelled ? (
                    <XCircle className="h-4.5 w-4.5 text-slate-600" />
                  ) : (
                    <Clock className="h-4.5 w-4.5 text-slate-600" />
                  )}
                </span>
                <div className="space-y-0.5">
                  <span className={`font-bold block ${logApproved ? 'text-white' : 'text-slate-500'}`}>Approved</span>
                  {logApproved && (
                    <span className="text-[10px] text-slate-400 block">
                      By {logApproved.user?.name || logApproved.userEmail || 'System'} on {new Date(logApproved.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Point 3: Dispatched */}
              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 bg-slate-900 p-0.5 rounded-full">
                  {logDispatched ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                  ) : logCancelled ? (
                    <XCircle className="h-4.5 w-4.5 text-slate-600" />
                  ) : (
                    <Clock className="h-4.5 w-4.5 text-slate-600" />
                  )}
                </span>
                <div className="space-y-0.5">
                  <span className={`font-bold block ${logDispatched ? 'text-white' : 'text-slate-500'}`}>Dispatched</span>
                  {logDispatched && (
                    <span className="text-[10px] text-slate-400 block">
                      By {logDispatched.user?.name || logDispatched.userEmail || 'System'} on {new Date(logDispatched.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Point 4: Completed or Cancelled */}
              {logCancelled ? (
                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 bg-slate-900 p-0.5 rounded-full">
                    <XCircle className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-bold text-rose-400 block">Cancelled</span>
                    <span className="text-[10px] text-slate-400 block">
                      By {logCancelled.user?.name || logCancelled.userEmail || 'System'} on {new Date(logCancelled.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 bg-slate-900 p-0.5 rounded-full">
                    {logCompleted ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                    ) : (
                      <Clock className="h-4.5 w-4.5 text-slate-600" />
                    )}
                  </span>
                  <div className="space-y-0.5">
                    <span className={`font-bold block ${logCompleted ? 'text-white' : 'text-slate-500'}`}>Completed</span>
                    {logCompleted && (
                      <span className="text-[10px] text-slate-400 block">
                        By {logCompleted.user?.name || logCompleted.userEmail || 'System'} on {new Date(logCompleted.timestamp).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side (1 Column): Assigned Vehicle & Driver Profiles */}
        <div className="lg:col-span-1 space-y-6">
          {/* Assigned Vehicle */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-white/5 flex items-center space-x-2">
              <Truck size={14} className="text-slate-400" />
              <span>Assigned Vehicle</span>
            </h3>

            {trip.assignedVehicle ? (
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Registration</span>
                  <span className="bg-slate-900 border border-white/10 text-white font-bold px-2 py-0.5 rounded">
                    {trip.assignedVehicle.registrationNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Model Name</span>
                  <span className="font-semibold text-white">{trip.assignedVehicle.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Type</span>
                  <span className="text-slate-300 font-semibold">{trip.assignedVehicle.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Load Capacity</span>
                  <span className="text-slate-300 font-semibold">{trip.assignedVehicle.loadCapacity.toLocaleString()} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Odometer</span>
                  <span className="text-slate-300 font-semibold">{trip.assignedVehicle.odometer.toLocaleString()} mi</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4 text-center">No vehicle assigned.</p>
            )}
          </div>

          {/* Assigned Driver */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-white/5 flex items-center space-x-2">
              <User size={14} className="text-slate-400" />
              <span>Assigned Operator</span>
            </h3>

            {trip.assignedDriver ? (
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Operator Name</span>
                  <span className="font-bold text-white">{trip.assignedDriver.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">License ID</span>
                  <span className="text-slate-300 font-semibold">{trip.assignedDriver.licenseNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Classification</span>
                  <span className="text-slate-300 font-semibold">{trip.assignedDriver.licenseCategory}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Safety Score</span>
                  <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-bold">
                    {trip.assignedDriver.safetyScore}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4 text-center">No operator assigned.</p>
            )}
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      {completeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay click away */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setCompleteModalOpen(false)}
          />
          <div className="glass-panel w-full max-w-md p-6 border border-white/10 rounded-2xl shadow-2xl relative z-10 space-y-6">
            <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-extrabold text-white">Complete Dispatched Trip</h3>
                <span className="text-[10px] text-slate-400 mt-0.5">Input final telemetry metrics to close trip.</span>
              </div>
            </div>

            {localError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-start space-x-2.5">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{localError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onCompleteSubmit)} className="space-y-4 text-xs">
              {/* Actual Distance */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Actual Distance Traveled (miles)
                </label>
                <input
                  type="number"
                  {...register('actualDistance')}
                  placeholder={`Planned was ${trip.plannedDistance} miles`}
                  className={`w-full bg-slate-900 border ${
                    errors.actualDistance ? 'border-rose-500' : 'border-white/10'
                  } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.actualDistance && (
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {errors.actualDistance.message}
                  </span>
                )}
              </div>

              {/* Fuel Consumed */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Fuel Consumed (Gallons)
                </label>
                <input
                  type="number"
                  {...register('fuelConsumed')}
                  placeholder="e.g. 24"
                  className={`w-full bg-slate-900 border ${
                    errors.fuelConsumed ? 'border-rose-500' : 'border-white/10'
                  } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.fuelConsumed && (
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {errors.fuelConsumed.message}
                  </span>
                )}
              </div>

              {/* Final Odometer */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Final Vehicle Odometer (mi)
                </label>
                <input
                  type="number"
                  {...register('finalOdometer')}
                  placeholder={`Must exceed previous ${trip.assignedVehicle?.odometer} mi`}
                  className={`w-full bg-slate-900 border ${
                    errors.finalOdometer ? 'border-rose-500' : 'border-white/10'
                  } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.finalOdometer && (
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {errors.finalOdometer.message}
                  </span>
                )}
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-semibold flex items-center space-x-1.5"
                >
                  {completeMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Completing...</span>
                    </>
                  ) : (
                    <span>Complete Trip</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
