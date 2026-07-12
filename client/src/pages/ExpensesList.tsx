import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Loader2,
  Database,
  Info
} from 'lucide-react';

const expenseFormSchema = z.object({
  category: z.enum(['Fuel', 'Maintenance', 'Toll', 'Parking', 'Repair', 'Insurance', 'Tax', 'Salary', 'Misc']),
  amount: z.coerce.number().positive('Expense amount must be positive'),
  date: z.string().min(1, 'Date is required'),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  tripId: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

const fuelFormSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  driverId: z.string().min(1, 'Driver is required'),
  date: z.string().min(1, 'Date is required'),
  odometer: z.coerce.number().nonnegative('Odometer reading cannot be negative'),
  fuelQuantity: z.coerce.number().positive('Fuel quantity must be positive'),
  price: z.coerce.number().positive('Fuel price must be positive'),
  totalCost: z.coerce.number().positive('Total cost must be positive'),
});

type FuelFormValues = z.infer<typeof fuelFormSchema>;

export default function ExpensesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'fuel' | 'expenses'>('fuel');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [fuelPage, setFuelPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const limit = 10;

  const isFinancial = user?.roleId === 'superadmin' || user?.roleId === 'fleet_manager' || user?.roleId === 'financial_analyst';
  const isDriverOrMore = isFinancial || user?.roleId === 'driver';

  // React Hook Forms
  const {
    register: regExpense,
    handleSubmit: handleExpenseSubmit,
    reset: resetExpense,
    formState: { errors: expenseErrors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { amount: 0, date: new Date().toISOString().split('T')[0] }
  });

  const {
    register: regFuel,
    handleSubmit: handleFuelSubmit,
    reset: resetFuel,
    setValue: setFuelValue,
    watch: watchFuel,
    formState: { errors: fuelErrors },
  } = useForm<FuelFormValues>({
    resolver: zodResolver(fuelFormSchema),
    defaultValues: { odometer: 0, fuelQuantity: 0, price: 3.85, totalCost: 0, date: new Date().toISOString().split('T')[0] }
  });

  // Watch values for quantity * price auto-calculation
  const quantity = watchFuel('fuelQuantity') || 0;
  const price = watchFuel('price') || 0;

  React.useEffect(() => {
    const cost = quantity * price;
    setFuelValue('totalCost', parseFloat(cost.toFixed(2)));
  }, [quantity, price, setFuelValue]);

  // Fetch Fuel Logs
  const { data: fuelLogsData, isLoading: isLoadingFuel } = useQuery({
    queryKey: ['fuelLogs', fuelPage],
    queryFn: async () => {
      const response = await api.get('/expenses/fuel', { params: { page: fuelPage, limit } });
      return response.data;
    }
  });

  // Fetch Expenses
  const { data: expensesData, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['expenses', expensePage],
    queryFn: async () => {
      const response = await api.get('/expenses', { params: { page: expensePage, limit } });
      return response.data;
    }
  });

  // Fetch Vehicles & Drivers (large limit to list in pickers)
  const { data: vehicles } = useQuery({
    queryKey: ['expenseVehicles'],
    queryFn: async () => {
      const response = await api.get('/vehicles', { params: { limit: 100 } });
      return response.data.vehicles;
    }
  });

  const { data: drivers } = useQuery({
    queryKey: ['expenseDrivers'],
    queryFn: async () => {
      const response = await api.get('/drivers', { params: { limit: 100 } });
      return response.data.drivers;
    }
  });

  const { data: trips } = useQuery({
    queryKey: ['expenseTrips'],
    queryFn: async () => {
      const response = await api.get('/trips', { params: { limit: 100 } });
      return response.data.trips;
    }
  });

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormValues) => api.post('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Expense Logged', 'Operational cost logged successfully.');
      setExpenseModalOpen(false);
      resetExpense();
    },
    onError: (err: any) => {
      toast('error', 'Logging Failed', err.response?.data?.error || 'Failed to log expense.');
    }
  });

  const addFuelMutation = useMutation({
    mutationFn: async (data: FuelFormValues) => api.post('/expenses/fuel', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuelLogs'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Fuel Logged', 'Fuel purchase logged successfully. Expense synchronized.');
      setFuelModalOpen(false);
      resetFuel();
    },
    onError: (err: any) => {
      toast('error', 'Logging Failed', err.response?.data?.error || 'Failed to log fuel purchase.');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Expense Deleted', 'Operational expense has been removed.');
    },
    onError: (err: any) => {
      toast('error', 'Deletion Failed', err.response?.data?.error || 'Failed to delete expense.');
    }
  });

  const deleteFuelMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expenses/fuel/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuelLogs'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast('success', 'Fuel Log Deleted', 'Fuel purchase record removed. Linked expense deleted.');
    },
    onError: (err: any) => {
      toast('error', 'Deletion Failed', err.response?.data?.error || 'Failed to delete fuel log.');
    }
  });

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <span>Operational Expenditures</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track fuel purchase logs, maintenance costs, and general operating expenditures.
          </p>
        </div>

        {/* Create buttons */}
        <div className="flex items-center space-x-2">
          {isDriverOrMore && (
            <button
              onClick={() => setFuelModalOpen(true)}
              className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center space-x-1.5"
            >
              <Plus size={14} />
              <span>Log Fuel</span>
            </button>
          )}

          {isFinancial && (
            <button
              onClick={() => setExpenseModalOpen(true)}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              <Plus size={14} />
              <span>Log Expense</span>
            </button>
          )}

          {isFinancial && (
            <button
              onClick={() => navigate('/expenses/summary')}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              <span>Cost Summaries</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex items-center space-x-1 border-b border-white/10">
        <button
          onClick={() => setActiveTab('fuel')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'fuel'
              ? 'border-primary text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Fuel Purchase Logs
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'expenses'
              ? 'border-primary text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Operational Expenses
        </button>
      </div>

      {/* Tables section */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {activeTab === 'fuel' ? (
          /* TAB 1: Fuel logs */
          isLoadingFuel ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
              <span>Loading fuel records...</span>
            </div>
          ) : !fuelLogsData || fuelLogsData.logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
              <span>No fuel logs recorded.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/15 bg-white/5 text-slate-400 font-semibold select-none">
                    <th className="p-4">Log Date</th>
                    <th className="p-4">Assigned Vehicle</th>
                    <th className="p-4">Operator</th>
                    <th className="p-4 text-right">Odometer Reading</th>
                    <th className="p-4 text-right">Quantity (Gal)</th>
                    <th className="p-4 text-right">Price per Gal</th>
                    <th className="p-4 text-right">Total Cost</th>
                    {isFinancial && <th className="p-4 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {fuelLogsData.logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-semibold text-white">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-bold">
                        {log.vehicle ? log.vehicle.registrationNumber : <span className="text-slate-500 italic">Deleted</span>}
                      </td>
                      <td className="p-4 font-medium">
                        {log.driver ? log.driver.name : <span className="text-slate-500 italic">Deleted</span>}
                      </td>
                      <td className="p-4 text-right font-mono">{log.odometer.toLocaleString()} mi</td>
                      <td className="p-4 text-right font-mono">{log.fuelQuantity.toFixed(2)} gal</td>
                      <td className="p-4 text-right font-mono">${log.price.toFixed(3)}</td>
                      <td className="p-4 text-right font-extrabold text-emerald-400">${log.totalCost.toLocaleString()}</td>
                      {isFinancial && (
                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this fuel log? Linked expense will be removed.')) {
                                deleteFuelMutation.mutate(log.id);
                              }
                            }}
                            className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 text-slate-400 rounded-lg transition-all"
                            title="Remove log"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 2: Expenses */
          isLoadingExpenses ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
              <span>Loading expenditures dataset...</span>
            </div>
          ) : !expensesData || expensesData.expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
              <span>No operational expenses logged.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/15 bg-white/5 text-slate-400 font-semibold select-none">
                    <th className="p-4">Expense Date</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-right">Cost Amount</th>
                    <th className="p-4">Vehicle Relation</th>
                    <th className="p-4">Operator Relation</th>
                    <th className="p-4">Trip Assignment</th>
                    {isFinancial && <th className="p-4 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {expensesData.expenses.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-semibold text-white">
                        {new Date(exp.date).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 border rounded-full text-[9px] font-extrabold uppercase ${
                          exp.category === 'Fuel' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                          exp.category === 'Maintenance' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                          'bg-slate-500/10 border-white/5 text-slate-300'
                        }`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-white">${exp.amount.toLocaleString()}</td>
                      <td className="p-4">
                        {exp.vehicle ? (
                          <span className="bg-slate-900 border border-white/10 px-1.5 py-0.5 rounded text-[10px] text-white">
                            {exp.vehicle.registrationNumber}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="p-4 font-medium">
                        {exp.driver ? exp.driver.name : <span className="text-slate-500 italic">—</span>}
                      </td>
                      <td className="p-4 font-medium">
                        {exp.trip ? (
                          <div className="flex items-center space-x-1">
                            <span>{exp.trip.source}</span>
                            <span>➔</span>
                            <span>{exp.trip.destination}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      {isFinancial && (
                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this operational expense log?')) {
                                deleteExpenseMutation.mutate(exp.id);
                              }
                            }}
                            className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 text-slate-400 rounded-lg transition-all"
                            title="Remove expense"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Footer Pagination */}
        {activeTab === 'fuel' && fuelLogsData && fuelLogsData.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs bg-white/5">
            <span className="text-slate-500">
              Showing page <span className="font-semibold text-slate-300">{fuelPage}</span> of{' '}
              <span className="font-semibold text-slate-300">{fuelLogsData.pagination.totalPages}</span>
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setFuelPage(p => Math.max(1, p - 1))}
                disabled={fuelPage === 1}
                className="p-1.5 border border-white/10 hover:bg-white/5 rounded-lg disabled:opacity-40 transition-all text-slate-300"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setFuelPage(p => Math.min(fuelLogsData.pagination.totalPages, p + 1))}
                disabled={fuelPage === fuelLogsData.pagination.totalPages}
                className="p-1.5 border border-white/10 hover:bg-white/5 rounded-lg disabled:opacity-40 transition-all text-slate-300"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && expensesData && expensesData.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs bg-white/5">
            <span className="text-slate-500">
              Showing page <span className="font-semibold text-slate-300">{expensePage}</span> of{' '}
              <span className="font-semibold text-slate-300">{expensesData.pagination.totalPages}</span>
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setExpensePage(p => Math.max(1, p - 1))}
                disabled={expensePage === 1}
                className="p-1.5 border border-white/10 hover:bg-white/5 rounded-lg disabled:opacity-40 transition-all text-slate-300"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setExpensePage(p => Math.min(expensesData.pagination.totalPages, p + 1))}
                disabled={expensePage === expensesData.pagination.totalPages}
                className="p-1.5 border border-white/10 hover:bg-white/5 rounded-lg disabled:opacity-40 transition-all text-slate-300"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fuel Log Modal */}
      {fuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setFuelModalOpen(false)} />
          <div className="glass-panel w-full max-w-md p-6 border border-white/10 rounded-2xl shadow-2xl relative z-10 space-y-6">
            <div className="pb-3 border-b border-white/5">
              <h3 className="text-sm font-extrabold text-white">Log Fuel Purchase</h3>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Log gallons and cost totals to synch expense databases.</span>
            </div>

            <form onSubmit={handleFuelSubmit((data) => addFuelMutation.mutate(data))} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Vehicle</label>
                <select
                  {...regFuel('vehicleId')}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="">Select Vehicle</option>
                  {vehicles?.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} — {v.name}</option>
                  ))}
                </select>
                {fuelErrors.vehicleId && <span className="text-[10px] text-rose-400 mt-1 block">{fuelErrors.vehicleId.message}</span>}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Driver/Operator</label>
                <select
                  {...regFuel('driverId')}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="">Select Operator</option>
                  {drivers?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {fuelErrors.driverId && <span className="text-[10px] text-rose-400 mt-1 block">{fuelErrors.driverId.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Purchase Date</label>
                  <input
                    type="date"
                    {...regFuel('date')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Odometer Reading (mi)</label>
                  <input
                    type="number"
                    {...regFuel('odometer')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Fuel (Gal)</label>
                  <input
                    type="number"
                    step="any"
                    {...regFuel('fuelQuantity')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Price / Gal</label>
                  <input
                    type="number"
                    step="any"
                    {...regFuel('price')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total Cost ($)</label>
                  <input
                    type="number"
                    step="any"
                    {...regFuel('totalCost')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setFuelModalOpen(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFuelMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-semibold"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setExpenseModalOpen(false)} />
          <div className="glass-panel w-full max-w-md p-6 border border-white/10 rounded-2xl shadow-2xl relative z-10 space-y-6">
            <div className="pb-3 border-b border-white/5">
              <h3 className="text-sm font-extrabold text-white">Log General Expense</h3>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Record operational cost tickets for reports.</span>
            </div>

            <form onSubmit={handleExpenseSubmit((data) => addExpenseMutation.mutate(data))} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                <select
                  {...regExpense('category')}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="Toll">Toll Fee</option>
                  <option value="Parking">Parking Fee</option>
                  <option value="Repair">Body/Glass Repair</option>
                  <option value="Insurance">Asset Insurance</option>
                  <option value="Tax">State/Road Tax</option>
                  <option value="Salary">Driver Salary payout</option>
                  <option value="Misc">Miscellaneous</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount ($)</label>
                  <input
                    type="number"
                    step="any"
                    {...regExpense('amount')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  {expenseErrors.amount && <span className="text-[10px] text-rose-400 mt-1 block">{expenseErrors.amount.message}</span>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    {...regExpense('date')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Linked Vehicle (Optional)</label>
                <select
                  {...regExpense('vehicleId')}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="">None</option>
                  {vehicles?.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} — {v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Linked Driver (Optional)</label>
                <select
                  {...regExpense('driverId')}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="">None</option>
                  {drivers?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Linked Trip (Optional)</label>
                <select
                  {...regExpense('tripId')}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="">None</option>
                  {trips?.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.source} to {t.destination}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExpenseMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-semibold"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
