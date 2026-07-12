import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { Wrench, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

const maintenanceSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  type: z.enum(['Preventive', 'Corrective', 'Breakdown']),
  serviceDate: z.string().min(1, 'Service date is required'),
  workshop: z.string().min(1, 'Workshop name is required'),
  mechanic: z.string().min(1, 'Mechanic name is required'),
  cost: z.coerce.number().min(0, 'Cost must be positive'),
  parts: z.string().optional().nullable(),
  labour: z.coerce.number().min(0, 'Labour cost must be positive').optional().nullable(),
  status: z.enum(['Pending', 'Scheduled', 'In Progress', 'Completed', 'Cancelled']),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

interface Vehicle {
  id: string;
  registrationNumber: string;
  name: string;
  status: string;
}

export default function MaintenanceForm() {
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
  } = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      vehicleId: '',
      type: 'Preventive',
      serviceDate: '',
      workshop: '',
      mechanic: '',
      cost: 0,
      parts: '',
      labour: 0,
      status: 'Pending',
    },
  });

  // Watch selected vehicle for trip conflict warning
  const selectedVehicleId = useWatch({ control, name: 'vehicleId' });

  // Fetch Vehicles (limit 100 to show complete list in picker)
  const { data: vehiclesData } = useQuery({
    queryKey: ['maintenanceVehicles'],
    queryFn: async () => {
      const response = await api.get('/vehicles', { params: { limit: 100 } });
      return response.data.vehicles as Vehicle[];
    }
  });

  const activeVehicles = vehiclesData?.filter(v => v.status !== 'Retired') || [];
  const selectedVehicle = vehiclesData?.find(v => v.id === selectedVehicleId);
  const isVehicleOnTrip = selectedVehicle?.status === 'On Trip';

  // Fetch initial data if editing
  const { data: recordData, isLoading: isFetching } = useQuery({
    queryKey: ['maintenanceRecord', id],
    queryFn: async () => {
      const response = await api.get(`/maintenance/${id}`);
      return response.data.record;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (recordData) {
      const formattedDate = new Date(recordData.serviceDate).toISOString().split('T')[0];
      reset({
        ...recordData,
        parts: recordData.parts || '',
        labour: recordData.labour || 0,
        serviceDate: formattedDate,
      });
    }
  }, [recordData, reset]);

  // Mutation for creating/updating
  const submitMutation = useMutation({
    mutationFn: async (data: MaintenanceFormValues) => {
      if (isEdit) {
        return await api.put(`/maintenance/${id}`, data);
      } else {
        return await api.post('/maintenance', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceRecords'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['maintenanceRecord', id] });
      }
      toast('success', `Service Record ${isEdit ? 'Updated' : 'Logged'}`, `The vehicle maintenance ticket has been saved.`);
      navigate('/maintenance');
    },
    onError: (err: any) => {
      setServerError(err.response?.data?.error || 'An error occurred while saving the service log.');
    },
  });

  const onSubmit = (data: MaintenanceFormValues) => {
    setServerError(null);
    submitMutation.mutate(data);
  };

  if (isEdit && isFetching) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span>Loading maintenance record...</span>
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
            <Wrench className="h-5 w-5 text-primary" />
            <span>{isEdit ? 'Edit Maintenance Ticket' : 'Log Maintenance Ticket'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Specify workshop diagnostic, labor costs, and service parts logs.
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
            {/* Vehicle Selection */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Vehicle
              </label>
              <select
                {...register('vehicleId')}
                disabled={isEdit}
                className={`w-full bg-slate-900/60 border ${
                  errors.vehicleId ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary disabled:opacity-50`}
              >
                <option value="">Select Fleet Vehicle</option>
                {activeVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} — {v.name} (Status: {v.status})
                  </option>
                ))}
              </select>
              {errors.vehicleId && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.vehicleId.message}
                </span>
              )}
              {isVehicleOnTrip && (
                <span className="text-[10px] text-rose-400 mt-1.5 flex items-center space-x-1 font-bold">
                  <AlertCircle size={10} />
                  <span>Warning: This vehicle is currently on a trip. Putting it in maintenance will fail until it returns.</span>
                </span>
              )}
            </div>

            {/* Service Category Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Service Type Category
              </label>
              <select
                {...register('type')}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary"
              >
                <option value="Preventive">Preventive Maintenance</option>
                <option value="Corrective">Corrective Repair</option>
                <option value="Breakdown">Emergency Breakdown</option>
              </select>
            </div>

            {/* Service Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Service/Inspection Date
              </label>
              <input
                type="date"
                {...register('serviceDate')}
                className={`w-full bg-slate-900/60 border ${
                  errors.serviceDate ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.serviceDate && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.serviceDate.message}
                </span>
              )}
            </div>

            {/* Workshop Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Service Workshop Center
              </label>
              <input
                type="text"
                {...register('workshop')}
                placeholder="e.g. Metro Garage Solutions"
                className={`w-full bg-slate-900/60 border ${
                  errors.workshop ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.workshop && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.workshop.message}
                </span>
              )}
            </div>

            {/* Mechanic Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Assigned Mechanic
              </label>
              <input
                type="text"
                {...register('mechanic')}
                placeholder="e.g. John Doe"
                className={`w-full bg-slate-900/60 border ${
                  errors.mechanic ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.mechanic && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.mechanic.message}
                </span>
              )}
            </div>

            {/* Cost */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Parts Cost ($)
              </label>
              <input
                type="number"
                {...register('cost')}
                placeholder="e.g. 150"
                className={`w-full bg-slate-900/60 border ${
                  errors.cost ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.cost && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.cost.message}
                </span>
              )}
            </div>

            {/* Labour Cost */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Labour Cost ($)
              </label>
              <input
                type="number"
                {...register('labour')}
                placeholder="e.g. 80"
                className={`w-full bg-slate-900/60 border ${
                  errors.labour ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.labour && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.labour.message}
                </span>
              )}
            </div>

            {/* Service Ticket Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Ticket status
              </label>
              <select
                {...register('status')}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary"
              >
                <option value="Pending">Pending</option>
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Replaced Parts */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Replaced Parts / Service logs
              </label>
              <textarea
                {...register('parts')}
                rows={3}
                placeholder="Oil filter, front brake pads, spark plugs..."
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/maintenance')}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging...</span>
                </>
              ) : (
                <span>Save Record</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
