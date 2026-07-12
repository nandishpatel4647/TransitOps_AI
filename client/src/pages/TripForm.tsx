import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { MapPin, ArrowLeft, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

const tripSchema = z.object({
  source: z.string().min(1, 'Source location is required'),
  destination: z.string().min(1, 'Destination location is required'),
  stops: z.string(),
  cargoType: z.string().min(1, 'Cargo type is required'),
  cargoWeight: z.coerce.number().positive('Cargo weight must be greater than zero'),
  priority: z.enum(['Low', 'Medium', 'High']),
  customer: z.string().min(1, 'Customer name is required'),
  notes: z.string().optional().nullable(),
  revenue: z.coerce.number().positive('Revenue must be positive'),
  plannedDistance: z.coerce.number().positive('Planned distance must be positive'),
  assignedVehicleId: z.string().min(1, 'Vehicle assignment is required'),
  assignedDriverId: z.string().min(1, 'Driver assignment is required'),
});

type TripFormValues = z.infer<typeof tripSchema>;

interface AssignableVehicle {
  id: string;
  registrationNumber: string;
  name: string;
  type: string;
  loadCapacity: number;
  odometer: number;
}

interface AssignableDriver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseCategory: string;
  safetyScore: number;
}

export default function TripForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = !!id;

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      source: '',
      destination: '',
      stops: '[]',
      cargoType: '',
      cargoWeight: 0,
      priority: 'Medium',
      customer: '',
      notes: '',
      revenue: 0,
      plannedDistance: 0,
      assignedVehicleId: '',
      assignedDriverId: '',
    },
  });

  // Watch fields for weight capacity check
  const selectedVehicleId = useWatch({ control, name: 'assignedVehicleId' });
  const cargoWeight = useWatch({ control, name: 'cargoWeight' }) || 0;

  // Fetch assignable vehicles and drivers
  const { data: assignableVehiclesData } = useQuery({
    queryKey: ['assignableVehicles'],
    queryFn: async () => {
      const response = await api.get('/vehicles/assignable');
      return response.data.vehicles as AssignableVehicle[];
    }
  });

  const { data: assignableDriversData } = useQuery({
    queryKey: ['assignableDrivers'],
    queryFn: async () => {
      const response = await api.get('/drivers/assignable');
      return response.data.drivers as AssignableDriver[];
    }
  });

  // Fetch initial data if editing
  const { data: tripData, isLoading: isFetching } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const response = await api.get(`/trips/${id}`);
      return response.data.trip;
    },
    enabled: isEdit,
  });

  // Merge currently assigned vehicle/driver if editing
  const [vehiclesList, setVehiclesList] = useState<AssignableVehicle[]>([]);
  const [driversList, setDriversList] = useState<AssignableDriver[]>([]);

  useEffect(() => {
    let list = assignableVehiclesData ? [...assignableVehiclesData] : [];
    if (isEdit && tripData?.assignedVehicle) {
      const exists = list.some(v => v.id === tripData.assignedVehicle.id);
      if (!exists) {
        list.unshift(tripData.assignedVehicle);
      }
    }
    setVehiclesList(list);
  }, [assignableVehiclesData, tripData, isEdit]);

  useEffect(() => {
    let list = assignableDriversData ? [...assignableDriversData] : [];
    if (isEdit && tripData?.assignedDriver) {
      const exists = list.some(d => d.id === tripData.assignedDriver.id);
      if (!exists) {
        list.unshift(tripData.assignedDriver);
      }
    }
    setDriversList(list);
  }, [assignableDriversData, tripData, isEdit]);

  useEffect(() => {
    if (tripData) {
      reset({
        ...tripData,
        notes: tripData.notes || '',
      });
    }
  }, [tripData, reset]);

  // Capacity Checker calculation
  const selectedVehicle = vehiclesList.find(v => v.id === selectedVehicleId);
  const isOverCapacity = selectedVehicle && cargoWeight > selectedVehicle.loadCapacity;

  // Mutation for creating/updating
  const submitMutation = useMutation({
    mutationFn: async (data: TripFormValues) => {
      if (isEdit) {
        return await api.put(`/trips/${id}`, data);
      } else {
        return await api.post('/trips', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['trip', id] });
      }
      toast('success', `Trip ${isEdit ? 'Updated' : 'Booked'}`, `The trip schedule details have been saved.`);
      navigate('/trips');
    },
    onError: (err: any) => {
      setServerError(err.response?.data?.error || 'An error occurred while saving the trip schedule.');
    },
  });

  const onSubmit = (data: TripFormValues) => {
    if (isOverCapacity) {
      toast('error', 'Capacity Limit Exceeded', 'Cargo weight exceeds assigned vehicle capacity.');
      return;
    }
    setServerError(null);
    submitMutation.mutate(data);
  };

  if (isEdit && isFetching) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span>Loading trip scheduling profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4 pb-4 border-b border-white/10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-primary" />
            <span>{isEdit ? 'Edit Scheduled Trip' : 'Book New Transport Trip'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Assign resources, cargo logs, and routing metrics.
          </p>
        </div>
      </div>

      {serverError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2.5 text-rose-400 text-xs">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold uppercase tracking-wider block text-[10px]">Operations Check Failed</span>
            <p className="leading-normal">{serverError}</p>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Source */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Starting Location (Source)
              </label>
              <input
                type="text"
                {...register('source')}
                placeholder="e.g. Chicago Depot"
                className={`w-full bg-slate-900/60 border ${
                  errors.source ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.source && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.source.message}</span>
              )}
            </div>

            {/* Destination */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Location (Destination)
              </label>
              <input
                type="text"
                {...register('destination')}
                placeholder="e.g. Detroit Logistics Center"
                className={`w-full bg-slate-900/60 border ${
                  errors.destination ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.destination && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.destination.message}</span>
              )}
            </div>

            {/* Customer */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Client / Customer
              </label>
              <input
                type="text"
                {...register('customer')}
                placeholder="e.g. Samsung Logistics"
                className={`w-full bg-slate-900/60 border ${
                  errors.customer ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.customer && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.customer.message}</span>
              )}
            </div>

            {/* Cargo Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Cargo Classification Type
              </label>
              <input
                type="text"
                {...register('cargoType')}
                placeholder="e.g. Electronics, Fresh Produce"
                className={`w-full bg-slate-900/60 border ${
                  errors.cargoType ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.cargoType && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.cargoType.message}</span>
              )}
            </div>

            {/* Cargo Weight */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Cargo Weight (kg)
              </label>
              <input
                type="number"
                {...register('cargoWeight')}
                placeholder="e.g. 500"
                className={`w-full bg-slate-900/60 border ${
                  errors.cargoWeight || isOverCapacity ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.cargoWeight && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.cargoWeight.message}</span>
              )}
              {isOverCapacity && (
                <span className="text-[10px] text-rose-400 mt-1.5 flex items-center space-x-1">
                  <AlertCircle size={10} />
                  <span>Cargo weight exceeds vehicle capacity of {selectedVehicle?.loadCapacity} kg!</span>
                </span>
              )}
            </div>

            {/* Revenue */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Trip Revenue ($)
              </label>
              <input
                type="number"
                {...register('revenue')}
                placeholder="e.g. 1800"
                className={`w-full bg-slate-900/60 border ${
                  errors.revenue ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.revenue && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.revenue.message}</span>
              )}
            </div>

            {/* Planned Distance */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Planned Distance (miles)
              </label>
              <input
                type="number"
                {...register('plannedDistance')}
                placeholder="e.g. 240"
                className={`w-full bg-slate-900/60 border ${
                  errors.plannedDistance ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.plannedDistance && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.plannedDistance.message}</span>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Trip Priority
              </label>
              <select
                {...register('priority')}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            {/* Assigned Vehicle */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Assign Transport Vehicle
              </label>
              <select
                {...register('assignedVehicleId')}
                className={`w-full bg-slate-900/60 border ${
                  errors.assignedVehicleId ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary`}
              >
                <option value="">Select Available Vehicle</option>
                {vehiclesList.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} — {v.name} ({v.type}, Cap: {v.loadCapacity}kg)
                  </option>
                ))}
              </select>
              {errors.assignedVehicleId && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.assignedVehicleId.message}</span>
              )}
            </div>

            {/* Assigned Driver */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Assign Driver/Operator
              </label>
              <select
                {...register('assignedDriverId')}
                className={`w-full bg-slate-900/60 border ${
                  errors.assignedDriverId ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary`}
              >
                <option value="">Select Available Driver</option>
                {driversList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} (CDL, Rating: {d.safetyScore.toFixed(1)}%)
                  </option>
                ))}
              </select>
              {errors.assignedDriverId && (
                <span className="text-[10px] text-rose-400 mt-1 block">{errors.assignedDriverId.message}</span>
              )}
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Special Operations Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Routing directives, gate codes, helper requirements..."
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/trips')}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending || isOverCapacity}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <span>Save Trip</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
