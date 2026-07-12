import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { Truck, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

const vehicleSchema = z.object({
  registrationNumber: z.string()
    .min(3, 'Registration number must be at least 3 characters')
    .max(15, 'Registration number cannot exceed 15 characters')
    .regex(/^[A-Z0-9-]+$/, 'Must be uppercase letters, numbers, and dashes only'),
  name: z.string().min(1, 'Name/Model is required'),
  type: z.string().min(1, 'Vehicle type is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  year: z.coerce.number().int().min(1950, 'Year must be after 1950').max(new Date().getFullYear() + 1, 'Invalid Year'),
  fuelType: z.string().min(1, 'Fuel type is required'),
  loadCapacity: z.coerce.number().positive('Capacity must be greater than zero'),
  odometer: z.coerce.number().nonnegative('Odometer must be non-negative'),
  acquisitionCost: z.coerce.number().nonnegative('Acquisition cost must be non-negative'),
  status: z.enum(['Available', 'On Trip', 'In Shop', 'Retired', 'Reserved', 'Breakdown']),
  region: z.string().min(1, 'Region is required'),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function VehicleForm() {
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
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      registrationNumber: '',
      name: '',
      type: '',
      manufacturer: '',
      year: new Date().getFullYear(),
      fuelType: '',
      loadCapacity: 0,
      odometer: 0,
      acquisitionCost: 0,
      status: 'Available',
      region: '',
    },
  });

  // Fetch initial data if editing
  const { data: vehicleData, isLoading: isFetching } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: async () => {
      const response = await api.get(`/vehicles/${id}`);
      return response.data.vehicle;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (vehicleData) {
      reset(vehicleData);
    }
  }, [vehicleData, reset]);

  // Mutation for creating/updating
  const submitMutation = useMutation({
    mutationFn: async (data: VehicleFormValues) => {
      if (isEdit) {
        return await api.put(`/vehicles/${id}`, data);
      } else {
        return await api.post('/vehicles', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
      }
      toast('success', `Vehicle ${isEdit ? 'Updated' : 'Created'}`, `Vehicle details have been saved.`);
      navigate('/vehicles');
    },
    onError: (err: any) => {
      setServerError(err.response?.data?.error || 'An error occurred while saving the vehicle record.');
    },
  });

  const onSubmit = (data: VehicleFormValues) => {
    setServerError(null);
    // Convert registration number to uppercase before submitting
    data.registrationNumber = data.registrationNumber.toUpperCase();
    submitMutation.mutate(data);
  };

  if (isEdit && isFetching) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span>Loading vehicle record...</span>
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
            <Truck className="h-5 w-5 text-primary" />
            <span>{isEdit ? 'Edit Vehicle Profile' : 'Register New Vehicle'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Fill in required fields below to configure the vehicle parameters.
          </p>
        </div>
      </div>

      {serverError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2.5 text-rose-400 text-xs">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold uppercase tracking-wider block text-[10px]">Constraint Violation</span>
            <p className="leading-normal">{serverError}</p>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Reg Number */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Registration Number
              </label>
              <input
                type="text"
                {...register('registrationNumber')}
                placeholder="e.g. VAN-09, SEMI-04"
                className={`w-full bg-slate-900/60 border ${
                  errors.registrationNumber ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.registrationNumber && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.registrationNumber.message}
                </span>
              )}
            </div>

            {/* Vehicle Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Vehicle Model Name
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="e.g. Ford Transit 250"
                className={`w-full bg-slate-900/60 border ${
                  errors.name ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.name && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.name.message}
                </span>
              )}
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Vehicle Type
              </label>
              <select
                {...register('type')}
                className={`w-full bg-slate-900/60 border ${
                  errors.type ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary`}
              >
                <option value="">Select Type</option>
                <option value="Cargo Van">Cargo Van</option>
                <option value="Semi-Truck">Semi-Truck</option>
                <option value="Truck">Box Truck</option>
              </select>
              {errors.type && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.type.message}
                </span>
              )}
            </div>

            {/* Manufacturer */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Manufacturer
              </label>
              <input
                type="text"
                {...register('manufacturer')}
                placeholder="e.g. Ford, Volvo, Kenworth"
                className={`w-full bg-slate-900/60 border ${
                  errors.manufacturer ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.manufacturer && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.manufacturer.message}
                </span>
              )}
            </div>

            {/* Manufacture Year */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Manufacture Year
              </label>
              <input
                type="number"
                {...register('year')}
                placeholder="e.g. 2021"
                className={`w-full bg-slate-900/60 border ${
                  errors.year ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.year && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.year.message}
                </span>
              )}
            </div>

            {/* Fuel Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Fuel Type
              </label>
              <select
                {...register('fuelType')}
                className={`w-full bg-slate-900/60 border ${
                  errors.fuelType ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary`}
              >
                <option value="">Select Fuel Type</option>
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
                <option value="Electric">Electric</option>
                <option value="CNG">CNG</option>
              </select>
              {errors.fuelType && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.fuelType.message}
                </span>
              )}
            </div>

            {/* Load Capacity */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Load Capacity (kg)
              </label>
              <input
                type="number"
                step="any"
                {...register('loadCapacity')}
                placeholder="e.g. 2500"
                className={`w-full bg-slate-900/60 border ${
                  errors.loadCapacity ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.loadCapacity && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.loadCapacity.message}
                </span>
              )}
            </div>

            {/* Odometer */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Current Odometer (mi)
              </label>
              <input
                type="number"
                step="any"
                {...register('odometer')}
                placeholder="e.g. 45000"
                className={`w-full bg-slate-900/60 border ${
                  errors.odometer ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.odometer && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.odometer.message}
                </span>
              )}
            </div>

            {/* Acquisition Cost */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Acquisition Cost ($)
              </label>
              <input
                type="number"
                step="any"
                {...register('acquisitionCost')}
                placeholder="e.g. 38000"
                className={`w-full bg-slate-900/60 border ${
                  errors.acquisitionCost ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.acquisitionCost && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.acquisitionCost.message}
                </span>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Current Status
              </label>
              <select
                {...register('status')}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary"
              >
                <option value="Available">Available</option>
                <option value="On Trip">On Trip</option>
                <option value="In Shop">In Shop</option>
                <option value="Breakdown">Breakdown</option>
                <option value="Reserved">Reserved</option>
                <option value="Retired">Retired</option>
              </select>
            </div>

            {/* Region */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Operational Region
              </label>
              <select
                {...register('region')}
                className={`w-full bg-slate-900/60 border ${
                  errors.region ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary`}
              >
                <option value="">Select Region</option>
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="East">East</option>
                <option value="West">West</option>
              </select>
              {errors.region && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.region.message}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/vehicles')}
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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Vehicle</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
