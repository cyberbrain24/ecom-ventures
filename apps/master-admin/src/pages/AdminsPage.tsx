import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Shield, ShieldCheck, Search, CheckCircle2, AlertCircle, X, Key, Pencil, Trash2, UserCheck } from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { AdminStaffUser } from '../types/system';
import { EditAdminModal } from '../components/admins/EditAdminModal';
import { ConfirmDeleteModal } from '../components/ui/ConfirmDeleteModal';
import { api, apiErrorMessage } from '../lib/api';

/**
 * Platform staff roster: lists operators, changes their status, and provisions new accounts.
 *
 * @returns The platform staff page
 */
export const AdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<AdminStaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminStaffUser | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminStaffUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Invite modal form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'PLATFORM_STAFF'>('PLATFORM_STAFF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAdmins = async () => {
    setIsLoading(true);
    setDataError(null);
    try {
      const res = await api.get<{ data: AdminStaffUser[] }>('/platform/admins');
      if (!Array.isArray(res.data?.data)) {
        throw new Error('The server returned the staff directory in an unexpected format.');
      }
      setAdmins(res.data.data);
    } catch (error) {
      setAdmins([]);
      setDataError(apiErrorMessage(error, 'Could not load administrators.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleToggleStatus = async (user: AdminStaffUser) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setStatusError(null);
    try {
      await api.patch(`/platform/admins/${user.id}`, { status: nextStatus });
      setAdmins((prev) =>
        prev.map((a) => (a.id === user.id ? { ...a, status: nextStatus } : a))
      );
    } catch (error) {
      setStatusError(`${user.email}: ${apiErrorMessage(error, 'Could not update administrator status.')}`);
    }
  };

  const handleUpdateAdmin = async (updated: AdminStaffUser): Promise<void> => {
    await api.patch(`/platform/admins/${updated.id}`, {
      first_name: updated.first_name,
      last_name: updated.last_name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
    });
    await fetchAdmins();
    setEditingAdmin(null);
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!deletingAdmin) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/platform/admins/${deletingAdmin.id}`);
      setDeletingAdmin(null);
      await fetchAdmins();
    } catch (err) {
      setDeleteError(apiErrorMessage(err, 'Could not delete administrator.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/platform/admins', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role,
      });
      await fetchAdmins();
      setIsInviteModalOpen(false);
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Failed to provision platform staff member.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAdmins = admins.filter((a) => {
    const matchesSearch =
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.first_name.toLowerCase().includes(search.toLowerCase()) ||
      a.last_name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || a.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const superAdminCount = admins.filter((a) => a.role === 'SUPER_ADMIN').length;
  const staffCount = admins.filter((a) => a.role === 'PLATFORM_STAFF').length;

  return (
    <div className="space-y-3.5">
      {/* Header */}
      {dataError && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          {dataError}
        </div>
      )}
      {statusError && (
        <div role="alert" className="flex items-start justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          <span className="whitespace-pre-line">{statusError}</span>
          <button onClick={() => setStatusError(null)} className="ml-3 font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Platform Staff & RBAC Roster</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage authorized platform operators, superadministrators, and role permissions across Ecom Ventures.
          </p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-sm transition space-x-2"
        >
          <UserPlus className="h-4 w-4" />
          <span>Invite Platform Operator</span>
        </button>
      </div>

      {/* Metric Cards - 7 Columns in One Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <MetricCard
          title="Total Operators"
          value={isLoading ? 'Loading' : admins.length}
          subtitle="Directory accounts"
          icon={Users}
        />
        <MetricCard
          title="Super Admins"
          value={isLoading ? 'Loading' : superAdminCount}
          subtitle="Role SUPER_ADMIN"
          icon={Shield}
        />
        <MetricCard
          title="Platform Staff"
          value={isLoading ? 'Loading' : staffCount}
          subtitle="Role PLATFORM_STAFF"
          icon={ShieldCheck}
        />
        <MetricCard
          title="Active Status"
          value={isLoading ? 'Loading' : admins.filter((a) => a.status === 'ACTIVE').length}
          subtitle="Status ACTIVE"
          icon={UserCheck}
        />
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">All RBAC Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="PLATFORM_STAFF">PLATFORM_STAFF</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading platform directory...</div>
        ) : filteredAdmins.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No platform staff records found.</div>
        ) : (
          <>
            {/* Mobile/Tablet Card View (< 1024px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3.5 p-3 sm:p-4">
              {filteredAdmins.map((user) => (
                <div
                  key={user.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs flex-shrink-0">
                        {user.first_name[0]}
                        {user.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-slate-500 font-mono leading-tight truncate mt-0.5">{user.email}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                        user.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {user.status === 'ACTIVE' ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {user.status}
                    </span>

                    <span className="text-[11px] text-slate-400">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : 'Never logged in'}
                    </span>
                  </div>

                  {/* Actions with min 44px touch targets */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`min-h-[44px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition border ${
                        user.status === 'ACTIVE'
                          ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setEditingAdmin(user)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                        title="Edit staff profile"
                        aria-label={`Edit ${user.email}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingAdmin(user)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete administrator"
                        aria-label={`Delete ${user.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Administrator</th>
                    <th className="px-3.5 py-2.5">Role Tier</th>
                    <th className="px-3.5 py-2.5">Account Status</th>
                    <th className="px-3.5 py-2.5">Last Authenticated</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdmins.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm flex-shrink-0">
                            {user.first_name[0]}
                            {user.last_name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm leading-tight">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-slate-500 font-mono leading-tight">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            user.role === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            user.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {user.status === 'ACTIVE' ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {user.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-500">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleString()
                          : 'Never logged in'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="inline-flex items-center space-x-2">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded transition border ${
                              user.status === 'ACTIVE'
                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>

                          <button
                            onClick={() => setEditingAdmin(user)}
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition"
                            title="Edit staff profile"
                            aria-label={`Edit ${user.email}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => setDeletingAdmin(user)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete administrator"
                            aria-label={`Delete ${user.email}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Provision Platform Staff Account</h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@yourcompany.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password</label>
                <div className="relative">
                  <Key className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned RBAC Tier</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="PLATFORM_STAFF">PLATFORM_STAFF (Delegated operations)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full administrative access)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Provisioning...' : 'Confirm Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <EditAdminModal
          user={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSave={handleUpdateAdmin}
        />
      )}

      {/* Delete Approval Confirmation Modal */}
      {deletingAdmin && (
        <ConfirmDeleteModal
          isOpen={!!deletingAdmin}
          title="Revoke & Delete Staff Account"
          itemName={`${deletingAdmin.first_name} ${deletingAdmin.last_name} (${deletingAdmin.email})`}
          itemType="Staff Account"
          warningMessage={`Are you sure you want to permanently revoke and delete the operator account for ${deletingAdmin.email}? This staff user will immediately lose all platform console access.`}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onConfirm={handleConfirmDeleteAdmin}
          onClose={() => {
            setDeleteError(null);
            setDeletingAdmin(null);
          }}
        />
      )}
    </div>
  );
};
