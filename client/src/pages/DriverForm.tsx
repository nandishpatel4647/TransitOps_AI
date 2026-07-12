import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { Users, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

const driverSchema = z.object({
  name: z.string().min(1, 'Operator name is required'),
  licenseNumber: z.string().min(3, 'License number is required'),
  licenseCategory: z.string().min(1, 'License category is required'),
  licenseExpiryDate: z.string().min(1, 'License expiry date is required'),
  contactNumber: z.string().min(5, 'Contact number is required'),
  emergencyContact: z.string().min(5, 'Emergency contact is required'),
  safetyScore: z.coerce.number().min(0, 'Score cannot be negative').max(100, 'Score cannot exceed 100'),
  status: z.enum(['Available', 'On Trip', 'Off Duty', 'Suspended', 'Leave']),
});

type DriverFormValues = z.infer<typeof driverSchema>;

export default function DriverForm() {
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
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: '',
      licenseNumber: '',
      licenseCategory: '',
      licenseExpiryDate: '',
      contactNumber: '',
      emergencyContact: '',
      safetyScore: 95,
      status: 'Available',
    },
  });

  // Fetch initial data if editing
  const { data: driverData, isLoading: isFetching } = useQuery({
    queryKey: ['driver', id],
    queryFn: async () => {
      const response = await api.get(`/drivers/${id}`);
      return response.data.driver;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (driverData) {
      // Format date to YYYY-MM-DD
      const formattedDate = new Date(driverData.licenseExpiryDate).toISOString().split('T')[0];
      reset({
        ...driverData,
        licenseExpiryDate: formattedDate
      });
    }
  }, [driverData, reset]);

  // Mutation for creating/updating
  const submitMutation = useMutation({
    mutationFn: async (data: DriverFormValues) => {
      if (isEdit) {
        return await api.put(`/drivers/${id}`, data);
      } else {
        return await api.post('/drivers', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['driver', id] });
      }
      toast('success', `Driver ${isEdit ? 'Updated' : 'Registered'}`, `Operator profile has been saved.`);
      navigate('/drivers');
    },
    onError: (err: any) => {
      setServerError(err.response?.data?.error || 'An error occurred while saving the driver profile.');
    },
  });

  const onSubmit = (data: DriverFormValues) => {
    setServerError(null);
    submitMutation.mutate(data);
  };

  if (isEdit && isFetching) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-500 text-xs">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span>Loading driver record...</span>
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
            <Users className="h-5 w-5 text-primary" />
            <span>{isEdit ? 'Edit Operator Profile' : 'Register Commercial Operator'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Specify driver details, license details, and contacts.
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Operator Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Full Operator Name
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="e.g. Alex Henderson"
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

            {/* License Number */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                License Number (Commercial)
              </label>
              <input
                type="text"
                {...register('licenseNumber')}
                placeholder="e.g. DL-123456"
                className={`w-full bg-slate-900/60 border ${
                  errors.licenseNumber ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.licenseNumber && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.licenseNumber.message}
                </span>
              )}
            </div>

            {/* License Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                License Category
              </label>
              <select
                {...register('licenseCategory')}
                className={`w-full bg-slate-900/60 border ${
                  errors.licenseCategory ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary`}
              >
                <option value="">Select Category</option>
                <option value="Class A CDL">Class A CDL (Heavy Combinations)</option>
                <option value="Class B CDL">Class B CDL (Single Heavy Trucks)</option>
                <option value="Class C CDL">Class C CDL (Light Commercial)</option>
                <option value="Standard Driver License">Standard Driver License</option>
              </select>
              {errors.licenseCategory && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.licenseCategory.message}
                </span>
              )}
            </div>

            {/* License Expiry Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                License Expiry Date
              </label>
              <input
                type="date"
                {...register('licenseExpiryDate')}
                className={`w-full bg-slate-900/60 border ${
                  errors.licenseExpiryDate ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.licenseExpiryDate && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.licenseExpiryDate.message}
                </span>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Contact Number
              </label>
              <input
                type="text"
                {...register('contactNumber')}
                placeholder="e.g. +1 555-0199"
                className={`w-full bg-slate-900/60 border ${
                  errors.contactNumber ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.contactNumber && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.contactNumber.message}
                </span>
              )}
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Emergency Contact (Name & Phone)
              </label>
              <input
                type="text"
                {...register('emergencyContact')}
                placeholder="e.g. Mary Henderson (+1 555-0198)"
                className={`w-full bg-slate-900/60 border ${
                  errors.emergencyContact ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.emergencyContact && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.emergencyContact.message}
                </span>
              )}
            </div>

            {/* Safety Score */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Safety Score Rating (%)
              </label>
              <input
                type="number"
                step="any"
                {...register('safetyScore')}
                placeholder="e.g. 95"
                className={`w-full bg-slate-900/60 border ${
                  errors.safetyScore ? 'border-rose-500' : 'border-white/10'
                } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
              />
              {errors.safetyScore && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {errors.safetyScore.message}
                </span>
              )}
            </div>

            {/* Current Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Operator Status
              </label>
              <select
                {...register('status')}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-primary"
              >
                <option value="Available">Available</option>
                <option value="On Trip">On Trip</option>
                <option value="Off Duty">Off Duty</option>
                <option value="Suspended">Suspended</option>
                <option value="Leave">Leave</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/drivers')}
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
                  <span>Registering...</span>
                </>
              ) : (
                <span>Save Driver Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
