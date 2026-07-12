import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { Camera, User, Lock, Key, ShieldCheck, Loader2 } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().optional().refine(val => !val || val.length >= 6, {
    message: 'Password must be at least 6 characters long',
  }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      password: '',
    },
  });

  if (!user) return null;

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await api.put('/profile', {
        name: data.name,
        password: data.password || undefined,
      });

      updateUser(response.data.user);
      setValue('password', ''); // clear password field
      toast('success', 'Profile updated', 'Your profile details have been saved successfully.');
    } catch (err: any) {
      toast('error', 'Update failed', err.response?.data?.error || 'Failed to update profile details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (2MB) and type
    if (file.size > 2 * 1024 * 1024) {
      toast('error', 'File too large', 'Avatar image size should not exceed 2MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast('error', 'Invalid type', 'Only image files are allowed.');
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(response.data.user);
      toast('success', 'Avatar updated', 'Your new profile avatar has been uploaded successfully.');
    } catch (err: any) {
      toast('error', 'Upload failed', err.response?.data?.error || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Profile Settings</h1>
          <p className="text-xs text-slate-400 mt-1">Manage your identity credentials and avatar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar Display */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center text-center">
          <div className="relative group cursor-pointer mt-4" onClick={handleAvatarClick}>
            <div className="h-28 w-28 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-2xl text-primary overflow-hidden relative shadow-lg">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                getInitials(user.name)
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
              )}

              <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            className="hidden"
            accept="image/*"
          />
          <h2 className="text-sm font-bold text-white mt-4">{user.name}</h2>
          <p className="text-xs text-slate-400 mt-1">{user.email}</p>
          <div className="mt-4 bg-primary/10 border border-primary/25 text-primary px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase">
            {user.role.name}
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Account Details</span>
          </h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  {...register('name')}
                  className={`w-full bg-slate-900/60 border ${
                    errors.name ? 'border-rose-500' : 'border-white/10'
                  } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
                />
                {errors.name && (
                  <span className="text-[10px] text-rose-400 mt-1 block">{errors.name.message}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address (Read Only)
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Lock className="h-4 w-4" />
                <span>Security (Change Password)</span>
              </h3>

              <div className="max-w-md">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  {...register('password')}
                  placeholder="Leave blank to keep current password"
                  className={`w-full bg-slate-900/60 border ${
                    errors.password ? 'border-rose-500' : 'border-white/10'
                  } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all`}
                />
                {errors.password && (
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {errors.password.message}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
