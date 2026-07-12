import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import {
  Compass,
  Loader2,
  CheckCircle2,
  XCircle,
  Truck,
  User,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileText,
  MapPin,
  Calendar,
  AlertCircle
} from 'lucide-react';

// Form validation schema for trip completion
const completionSchema = z.object({
  actualDistance: z.coerce.number().positive('Actual distance must be positive'),
  fuelConsumed: z.coerce.number().positive('Fuel consumed must be positive'),
  finalOdometer: z.coerce.number().positive('Final odometer must be positive'),
});

type CompletionFormValues = z.infer<typeof completionSchema>;

interface Trip {
  id: string;
  source: string;
  destination: string;
  customer: string;
  cargoType: string;
  cargoWeight: number;
  revenue: number;
  plannedDistance: number;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Draft' | 'Approved' | 'Dispatched' | 'Completed' | 'Cancelled';
  assignedVehicle?: {
    id: string;
    registrationNumber: string;
    name: string;
    odometer: number;
  };
  assignedDriver?: {
    id: string;
    name: string;
    licenseNumber: string;
  };
}

const COLUMNS = [
  { id: 'Draft', title: 'Draft', color: 'border-slate-500/30 bg-slate-900/40' },
  { id: 'Approved', title: 'Approved', color: 'border-violet-500/30 bg-violet-950/10' },
  { id: 'Dispatched', title: 'Dispatched', color: 'border-blue-500/30 bg-blue-950/10' },
  { id: 'Completed', title: 'Completed', color: 'border-emerald-500/30 bg-emerald-950/10' },
  { id: 'Cancelled', title: 'Cancelled', color: 'border-rose-500/30 bg-rose-950/10' },
];

export default function DispatchBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [draggedTrip, setDraggedTrip] = useState<Trip | null>(null);
  const [completingTrip, setCompletingTrip] = useState<Trip | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CompletionFormValues>({
    resolver: zodResolver(completionSchema)
  });

  // Fetch Trips dataset (large limit to list all relevant board columns)
  const { data: tripsData, isLoading: isLoadingTrips } = useQuery({
    queryKey: ['dispatchTrips'],
    queryFn: async () => {
      const response = await api.get('/trips', { params: { limit: 100 } });
      return response.data.trips as Trip[];
    }
  });

  // Fetch Available Fleet resources
  const { data: vehiclesData } = useQuery({
    queryKey: ['availableVehiclesCount'],
    queryFn: async () => {
      const response = await api.get('/vehicles/assignable');
      return response.data.vehicles;
    }
  });

  const { data: driversData } = useQuery({
    queryKey: ['availableDriversCount'],
    queryFn: async () => {
      const response = await api.get('/drivers/assignable');
      return response.data.drivers;
    }
  });

  const availableVehiclesCount = vehiclesData?.length || 0;
  const availableDriversCount = driversData?.length || 0;

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async (tripId: string) => api.post(`/trips/${tripId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatchTrips'] });
      toast('success', 'Trip Approved', 'Trip status advanced to Approved.');
    },
    onError: (err: any) => {
      toast('error', 'Action Failed', err.response?.data?.error || 'Failed to approve trip.');
    }
  });

  const dispatchMutation = useMutation({
    mutationFn: async (tripId: string) => api.post(`/trips/${tripId}/dispatch`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatchTrips'] });
      queryClient.invalidateQueries({ queryKey: ['availableVehiclesCount'] });
      queryClient.invalidateQueries({ queryKey: ['availableDriversCount'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Trip Dispatched', 'Trip dispatched successfully! Vehicle & driver statuses updated to On Trip.');
    },
    onError: (err: any) => {
      toast('error', 'Dispatch Failed', err.response?.data?.error || 'Failed to dispatch trip.');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (tripId: string) => api.post(`/trips/${tripId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatchTrips'] });
      queryClient.invalidateQueries({ queryKey: ['availableVehiclesCount'] });
      queryClient.invalidateQueries({ queryKey: ['availableDriversCount'] });
      toast('success', 'Trip Cancelled', 'Trip cancelled. Assets released to Available.');
    },
    onError: (err: any) => {
      toast('error', 'Action Failed', err.response?.data?.error || 'Failed to cancel trip.');
    }
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompletionFormValues }) => 
      api.post(`/trips/${id}/complete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatchTrips'] });
      queryClient.invalidateQueries({ queryKey: ['availableVehiclesCount'] });
      queryClient.invalidateQueries({ queryKey: ['availableDriversCount'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Trip Completed', 'Trip completed. Telemetry recorded.');
      setCompleteModalOpen(false);
      setCompletingTrip(null);
      reset();
      setLocalError(null);
    },
    onError: (err: any) => {
      setLocalError(err.response?.data?.error || 'Failed to complete trip.');
    }
  });

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent, trip: Trip) => {
    setDraggedTrip(trip);
    e.dataTransfer.setData('text/plain', trip.id);
  };

  const handleDragOver = (e: React.DragEvent, targetStatus: string) => {
    if (!draggedTrip) return;
    
    // Validate target transitions
    const currentStatus = draggedTrip.status;
    let allowed = false;

    if (currentStatus === 'Draft' && (targetStatus === 'Approved' || targetStatus === 'Cancelled')) allowed = true;
    if (currentStatus === 'Approved' && (targetStatus === 'Dispatched' || targetStatus === 'Cancelled')) allowed = true;
    if (currentStatus === 'Dispatched' && (targetStatus === 'Completed' || targetStatus === 'Cancelled')) allowed = true;

    if (allowed) {
      e.preventDefault(); // allow drop
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (!draggedTrip) return;

    processTransition(draggedTrip, targetStatus);
    setDraggedTrip(null);
  };

  const processTransition = (trip: Trip, targetStatus: string) => {
    if (targetStatus === 'Approved') {
      approveMutation.mutate(trip.id);
    } else if (targetStatus === 'Dispatched') {
      dispatchMutation.mutate(trip.id);
    } else if (targetStatus === 'Cancelled') {
      if (window.confirm(`Are you sure you want to cancel the trip from ${trip.source} to ${trip.destination}?`)) {
        cancelMutation.mutate(trip.id);
      }
    } else if (targetStatus === 'Completed') {
      setCompletingTrip(trip);
      setCompleteModalOpen(true);
    }
  };

  const onCompleteSubmit = (data: CompletionFormValues) => {
    if (!completingTrip) return;
    setLocalError(null);
    completeMutation.mutate({ id: completingTrip.id, data });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'border-l-rose-500';
      case 'Medium': return 'border-l-amber-500';
      default: return 'border-l-slate-400';
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Header with Live Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Compass className="h-5 w-5 text-primary" />
            <span>Smart Dispatch Board</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Drag and drop trips to dispatch resources, trigger completions, or cancel schedules.
          </p>
        </div>

        {/* Live Resource Counters */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Vehicles count */}
          <div className="glass-panel px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center space-x-2">
            <Truck size={14} className="text-emerald-400" />
            <span className="text-slate-400">Available Vehicles:</span>
            <span className="font-extrabold text-white">{availableVehiclesCount}</span>
          </div>

          {/* Drivers count */}
          <div className="glass-panel px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center space-x-2">
            <User size={14} className="text-violet-400" />
            <span className="text-slate-400">Available Drivers:</span>
            <span className="font-extrabold text-white">{availableDriversCount}</span>
          </div>
        </div>
      </div>

      {/* Board Columns Grid */}
      <div className="flex-1 overflow-hidden min-h-0">
        {isLoadingTrips ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
            <span>Syncing dispatch telemetry...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full overflow-x-auto pb-4">
            {COLUMNS.map((col) => {
              // Filter trips belonging to this status column
              const columnTrips = tripsData?.filter(t => t.status === col.id) || [];
              
              // Validate highlight if dragging
              const isOverAllowed = draggedTrip && (
                (draggedTrip.status === 'Draft' && (col.id === 'Approved' || col.id === 'Cancelled')) ||
                (draggedTrip.status === 'Approved' && (col.id === 'Dispatched' || col.id === 'Cancelled')) ||
                (draggedTrip.status === 'Dispatched' && (col.id === 'Completed' || col.id === 'Cancelled'))
              );

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`glass-panel border-t-2 rounded-2xl flex flex-col h-full min-w-[220px] transition-all p-3 ${
                    col.color
                  } ${isOverAllowed ? 'ring-2 ring-primary/40 scale-[1.01]' : ''}`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10 shrink-0">
                    <span className="font-bold text-white text-xs">{col.title}</span>
                    <span className="bg-white/5 border border-white/10 text-slate-400 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                      {columnTrips.length}
                    </span>
                  </div>

                  {/* Column Cards Container */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                    {columnTrips.length === 0 ? (
                      <div className="text-[10px] text-slate-600 text-center py-8 italic">
                        No trips in column
                      </div>
                    ) : (
                      columnTrips.map((t) => {
                        const canDrag = t.status !== 'Completed' && t.status !== 'Cancelled';
                        return (
                          <div
                            key={t.id}
                            draggable={canDrag}
                            onDragStart={(e) => handleDragStart(e, t)}
                            className={`glass-panel bg-slate-950/60 p-3 rounded-xl border border-white/10 border-l-4 ${getPriorityColor(
                              t.priority
                            )} select-none ${
                              canDrag ? 'cursor-grab active:cursor-grabbing hover:border-white/20 transition-all' : 'opacity-85'
                            }`}
                          >
                            {/* Card Content */}
                            <div className="space-y-2 text-xs">
                              {/* Route */}
                              <div className="font-extrabold text-white flex items-center space-x-1">
                                <span className="truncate max-w-[80px]">{t.source}</span>
                                <ArrowRight size={10} className="text-slate-500 shrink-0" />
                                <span className="truncate max-w-[80px]">{t.destination}</span>
                              </div>

                              {/* Customer info */}
                              <div className="text-[10px] text-slate-400 flex justify-between">
                                <span className="truncate font-semibold max-w-[120px]">{t.customer}</span>
                                <span className="text-emerald-400 font-extrabold">${t.revenue.toLocaleString()}</span>
                              </div>

                              {/* Cargo details */}
                              <div className="text-[10px] text-slate-500">
                                {t.cargoType} • {t.cargoWeight} kg
                              </div>

                              {/* Assignments summary info */}
                              {(t.assignedVehicle || t.assignedDriver) && (
                                <div className="pt-2 border-t border-white/5 space-y-1 text-[9px] text-slate-500">
                                  {t.assignedVehicle && (
                                    <div className="flex items-center space-x-1 truncate">
                                      <Truck size={10} className="text-slate-500 shrink-0" />
                                      <span className="font-bold text-slate-400">{t.assignedVehicle.registrationNumber}</span>
                                    </div>
                                  )}
                                  {t.assignedDriver && (
                                    <div className="flex items-center space-x-1 truncate">
                                      <User size={10} className="text-slate-500 shrink-0" />
                                      <span className="font-bold text-slate-400">{t.assignedDriver.name}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Status Select dropdown for mobile accessibility */}
                              {canDrag && (
                                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                                  <span className="text-[8px] uppercase font-bold text-slate-500">Move status</span>
                                  <select
                                    value={t.status}
                                    onChange={(e) => processTransition(t, e.target.value)}
                                    className="bg-slate-900 border border-white/5 rounded text-[9px] text-slate-300 font-bold focus:outline-none cursor-pointer py-0.5 px-1"
                                  >
                                    <option value={t.status} disabled>{t.status}</option>
                                    {t.status === 'Draft' && (
                                      <>
                                        <option value="Approved">Approved</option>
                                        <option value="Cancelled">Cancelled</option>
                                      </>
                                    )}
                                    {t.status === 'Approved' && (
                                      <>
                                        <option value="Dispatched">Dispatched</option>
                                        <option value="Cancelled">Cancelled</option>
                                      </>
                                    )}
                                    {t.status === 'Dispatched' && (
                                      <>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                      </>
                                    )}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completion Modal */}
      {completeModalOpen && completingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setCompleteModalOpen(false);
              setCompletingTrip(null);
            }}
          />
          <div className="glass-panel w-full max-w-md p-6 border border-white/10 rounded-2xl shadow-2xl relative z-10 space-y-6">
            <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-extrabold text-white">Complete Dispatched Trip</h3>
                <span className="text-[10px] text-slate-400 mt-0.5 font-medium block">
                  Route: {completingTrip.source} ➔ {completingTrip.destination}
                </span>
              </div>
            </div>

            {localError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-start space-x-2.5">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
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
                  placeholder={`Planned was ${completingTrip.plannedDistance} miles`}
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
                  placeholder="e.g. 25"
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
                  placeholder={`Must exceed previous ${completingTrip.assignedVehicle?.odometer} mi`}
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
                  onClick={() => {
                    setCompleteModalOpen(false);
                    setCompletingTrip(null);
                  }}
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
