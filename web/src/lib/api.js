import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast.jsx';

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `The server answered with ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const useSession = () => useQuery({ queryKey: ['session'], queryFn: () => api('/session'), staleTime: Infinity });

export const useWorkspace = () => useQuery({ queryKey: ['workspace'], queryFn: () => api('/data') });

// Mutations refresh the workspace and report the outcome in a toast.
// Call as mutate({ path, method, body, success }) where success is a message or (result) => message.
export function useApiMutation({ onSuccess } = {}) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ path, method = 'POST', body }) => api(path, { method, body }),
    onSuccess: async (result, variables) => {
      await client.invalidateQueries({ queryKey: ['workspace'] });
      const message = typeof variables.success === 'function' ? variables.success(result) : variables.success;
      if (message) toast(message);
      onSuccess?.(result, variables);
    },
    onError: (error) => toast(error.message, 'error'),
  });
}

// Id lookups shared by most screens.
export function useLookups(data) {
  return useMemo(() => {
    if (!data) return null;
    const index = (rows = []) => new Map(rows.map((row) => [row.id, row]));
    const invoicesBySubscription = new Map();
    for (const invoice of data.invoices) {
      const list = invoicesBySubscription.get(invoice.subscriptionId) || [];
      list.push(invoice);
      invoicesBySubscription.set(invoice.subscriptionId, list);
    }
    return {
      products: index(data.products),
      plans: index(data.plans),
      customers: index(data.customers),
      taxes: index(data.taxes),
      discounts: index(data.discounts),
      subscriptions: index(data.subscriptions),
      invoices: index(data.invoices),
      invoicesBySubscription,
    };
  }, [data]);
}

export const lineTotal = (lines = []) => lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
