import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiMutation, useWorkspace } from '../lib/api.js';
import { capitalize } from '../lib/format.js';
import { Button } from '../components/Button.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Drawer } from '../components/Drawer.jsx';
import { Field, FormGrid, Input, Select } from '../components/Field.jsx';
import { Loading, PageHeader, Toolbar } from '../components/Layout.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { PasswordRules, passwordIsStrong } from './Auth.jsx';

const ACCESS = {
  admin: 'Everything, including the catalog, discounts and team',
  staff: 'Customers, quotes, subscriptions, billing and payments',
  customer: 'Their own subscriptions and invoices in the portal',
};

function MemberForm({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'staff', password: '' });
  const create = useApiMutation({ onSuccess: onClose });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  return (
    <Drawer open onClose={onClose} kicker="Team and access" title="Add team member"
      footer={<><Button type="submit" form="member-form" busy={create.isPending} disabled={!passwordIsStrong(form.password)}>Add member</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></>}>
      <form id="member-form" onSubmit={(event) => { event.preventDefault(); create.mutate({ path: '/users', body: form, success: `${form.name} can now sign in as ${form.role}.` }); }}>
        <FormGrid>
          <Field label="Full name"><Input value={form.name} onChange={set('name')} required /></Field>
          <Field label="Work email"><Input type="email" value={form.email} onChange={set('email')} required /></Field>
          <Field label="Role" hint={ACCESS[form.role]} className="sm:col-span-2"><Select value={form.role} onChange={set('role')}><option value="staff">Staff</option><option value="admin">Admin</option></Select></Field>
          <Field label="Temporary password" hint="They can change it with Forgot password" className="sm:col-span-2">
            <Input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
            <PasswordRules value={form.password} />
          </Field>
        </FormGrid>
      </form>
    </Drawer>
  );
}

export default function Team() {
  const { data, isLoading } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [role, setRole] = useState('internal');
  if (isLoading) return <Loading />;

  const users = data.users || [];
  const rows = users.filter((user) => (role === 'internal' ? user.role !== 'customer' : user.role === 'customer'));
  const columns = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-semibold">{row.name}{row.id === data.user.id && <span className="ml-2 font-normal text-mute">(you)</span>}</span> },
    { key: 'email', header: 'Email', render: (row) => <span className="text-mute">{row.email}</span> },
    { key: 'role', header: 'Role', render: (row) => capitalize(row.role) },
    { key: 'access', header: 'Can work with', render: (row) => <span className="text-mute">{ACCESS[row.role]}</span> },
  ];

  return (
    <div>
      <PageHeader title="Team and access" description="Who can sign in and what they can see. Only administrators can add members of staff." actions={<Button onClick={() => setParams({ new: '1' })}>Add team member</Button>} />
      <Tabs label="Filter accounts" value={role} onChange={setRole} items={[{ value: 'internal', label: 'Brightloop team', count: users.filter((user) => user.role !== 'customer').length }, { value: 'customer', label: 'Customer logins', count: users.filter((user) => user.role === 'customer').length }]} />
      <Toolbar><span className="text-body text-mute">{rows.length} accounts</span></Toolbar>
      <DataTable columns={columns} rows={rows} minWidth={640} />
      {params.get('new') && <MemberForm onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}
