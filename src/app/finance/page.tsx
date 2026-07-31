'use client';

// Rebuilt 2026-07-31 alongside the API-only CFO report. The email-parsing AP
// pipeline and its tables (ap_transactions, finance_daily_snapshots, ...) were
// deleted; daily spend and upcoming payments now arrive in the CFO Daily
// Report email. The only table left is finance.ar_invoices — the human-curated
// list of open invoices ("NOS DEBEN") — and this page is its editor.

import React, { useEffect, useState } from 'react';
import { financeSupabase } from '@/lib/finance_supabase';
import MetricCard from './components/MetricCard';

const CURRENCIES = ['AED', 'USD', 'EUR'];

export default function FinanceDashboard() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingInvoice, setIsAddingInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ client_name: '', description: '', amount: '', currency: 'AED', due_date: '', status: 'pending' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: arErr } = await financeSupabase
        .from('ar_invoices')
        .select('*')
        .order('due_date', { ascending: true });
      if (arErr) throw arErr;
      setInvoices(data || []);
    } catch (err: any) {
      console.error('Error fetching AR invoices:', err);
      setError('Failed to load invoices from finance.ar_invoices.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = {
      client_name: newInvoice.client_name,
      description: newInvoice.description || 'Monthly Retainer',
      amount: parseFloat(newInvoice.amount),
      currency: newInvoice.currency,
      due_date: newInvoice.due_date,
      status: newInvoice.status,
    };
    const { error: insErr } = await financeSupabase.from('ar_invoices').insert(payload);
    setIsSubmitting(false);
    if (!insErr) {
      setIsAddingInvoice(false);
      setNewInvoice({ client_name: '', description: '', amount: '', currency: 'AED', due_date: '', status: 'pending' });
      loadData();
    } else {
      alert('Failed to add invoice: ' + insErr.message);
    }
  };

  const markInvoicePaid = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const { error: updErr } = await financeSupabase.from('ar_invoices').update({ status: 'paid' }).eq('id', id);
    if (!updErr) {
      loadData();
    } else {
      alert('Failed to update status.');
      btn.disabled = false;
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date();
  const open = invoices.filter((inv) => inv.status !== 'paid');
  const overdue = open.filter((inv) => inv.due_date && new Date(inv.due_date) < today);

  const totalsByCurrency: Record<string, number> = {};
  for (const inv of open) {
    const cur = inv.currency || 'USD';
    totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + Number(inv.amount || 0);
  }
  const totalsLabel = Object.entries(totalsByCurrency)
    .map(([cur, amt]) => `${cur} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    .join(' · ') || '0.00';

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end pb-6 border-b border-white/10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Accounts Receivable</h1>
            <p className="text-gray-400">Facturas abiertas — la fuente del bloque NOS DEBEN del CFO Daily Report</p>
          </div>
          <div className="mt-4 md:mt-0 text-sm text-gray-500">
            El gasto diario y los próximos pagos llegan por el CFO Daily Report (email, 07:00 Dubái)
          </div>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="Outstanding"
            value={totalsLabel}
            description="Total de facturas abiertas"
            trend={open.length > 0 ? 'up' : 'neutral'}
            trendValue={`${open.length} factura(s)`}
          />
          <MetricCard
            title="Overdue"
            value={String(overdue.length)}
            description="Facturas vencidas sin pagar"
            trend={overdue.length > 0 ? 'down' : 'neutral'}
            trendValue={overdue.length > 0 ? 'Cobrar ya' : 'Al día'}
          />
          <MetricCard
            title="Paid (historial)"
            value={String(invoices.length - open.length)}
            description="Facturas marcadas pagadas"
            trend="neutral"
            trendValue="Registro manual"
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Facturas</h2>
            <div className="flex items-center gap-4">
              <button onClick={loadData} disabled={loading} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => setIsAddingInvoice(!isAddingInvoice)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-semibold transition-colors"
              >
                {isAddingInvoice ? 'Cancel' : '+ Add Invoice'}
              </button>
            </div>
          </div>

          {isAddingInvoice && (
            <form onSubmit={handleAddInvoice} className="bg-white/10 p-5 rounded-lg border border-white/20">
              <h4 className="text-white font-medium mb-4">Registrar factura abierta</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Client Name</label>
                  <input required type="text" value={newInvoice.client_name} onChange={(e) => setNewInvoice({ ...newInvoice, client_name: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" placeholder="e.g. HAQQ (Antoine Kanaan)" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Amount</label>
                    <input required type="number" step="0.01" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" placeholder="11900.00" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Currency</label>
                    <select value={newInvoice.currency} onChange={(e) => setNewInvoice({ ...newInvoice, currency: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded p-2 text-white">
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <input type="text" value={newInvoice.description} onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" placeholder="Monthly Retainer" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                  <input required type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-colors disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save Invoice'}
              </button>
            </form>
          )}

          {loading && !error ? (
            <div className="h-40 flex items-center justify-center border border-white/5 bg-white/5 rounded-2xl animate-pulse">
              <span className="text-gray-500 font-medium">Loading invoices...</span>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-1">
              {invoices.length > 0 ? (
                invoices.map((inv) => {
                  const isOverdue = inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < today;
                  return (
                    <div key={inv.id} className="flex justify-between items-center py-4 px-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                      <div className="flex flex-col space-y-1">
                        <span className="text-white font-semibold text-base">{inv.client_name}</span>
                        <span className="text-gray-400 text-xs">{inv.description || 'Monthly Retainer'}</span>
                        <span className={`text-xs ${isOverdue ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
                          Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}{isOverdue ? ' · OVERDUE' : ''}
                        </span>
                      </div>
                      <div className="text-right flex flex-col items-end justify-center space-y-2">
                        <span className="text-white font-bold block">{inv.currency || 'USD'} {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center space-x-2">
                          {inv.status !== 'paid' && (
                            <button onClick={(e) => markInvoicePaid(inv.id, e)} className="text-[10px] bg-indigo-500/80 hover:bg-indigo-500 text-white px-2 py-0.5 rounded font-bold uppercase transition-colors">
                              Mark Paid
                            </button>
                          )}
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                            isOverdue ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p className="mb-2">No hay facturas registradas.</p>
                  <p className="text-xs">Usa &quot;+ Add Invoice&quot; para registrar ingresos esperados.</p>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
