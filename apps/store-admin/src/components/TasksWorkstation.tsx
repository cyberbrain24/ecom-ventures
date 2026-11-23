import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  RefreshCw,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Filter,
} from 'lucide-react';
import type { StoreBrand, StoreTask, TaskCategory, StoreStaff } from '../types/store';
import {
  fetchTasks,
  fetchTaskCategories,
  createStoreTask,
  updateStoreTask,
  completeStoreTask,
  deleteStoreTask,
  fetchStoreStaffMembers,
  createTaskCategory,
} from '../lib/tasks-api';

interface TasksWorkstationProps {
  currentStore: StoreBrand;
  currentUserId?: string;
  userRole?: string;
}

export const TasksWorkstation: React.FC<TasksWorkstationProps> = ({
  currentStore,
  currentUserId,
  userRole = 'STORE_STAFF',
}) => {
  const [tasks, setTasks] = useState<StoreTask[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [staffList, setStaffList] = useState<StoreStaff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active Assignee Tab Selection (Auto-focus engine)
  const [activeAssigneeKey, setActiveAssigneeKey] = useState<string>('all');
  const [customAssigneeIds, setCustomAssigneeIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`poshplex_task_assignee_tabs_${currentStore.slug}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Category filter
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Completed Archive Accordion Toggle
  const [isArchiveExpanded, setIsArchiveExpanded] = useState<boolean>(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);

  // Active Task for Edit / Complete
  const [targetTask, setTargetTask] = useState<StoreTask | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formAssigneeId, setFormAssigneeId] = useState<string>('');
  const [formCompletionComment, setFormCompletionComment] = useState<string>('');
  const [submittingForm, setSubmittingForm] = useState<boolean>(false);

  // New Category Form State
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>('#3b82f6');

  // Permission checks
  const canDelete = userRole === 'STORE_OWNER' || userRole === 'STORE_ADMIN';

  // Load initial data
  const loadWorkstationData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [allTasks, allCats, allStaff] = await Promise.all([
        fetchTasks(),
        fetchTaskCategories(),
        fetchStoreStaffMembers(),
      ]);
      setTasks(allTasks);
      setCategories(allCats);
      setStaffList(allStaff);

      // Identity Auto-Focus Engine:
      // Priority 1: If current logged-in user has assigned tasks, focus on their tab
      // Priority 2: Focus on first staff member with tasks
      // Priority 3: Fallback to 'all'
      if (activeAssigneeKey === 'all' && currentUserId) {
        const hasMyTasks = allTasks.some((t) => t.assignee_id === currentUserId);
        if (hasMyTasks) {
          setActiveAssigneeKey(currentUserId);
        } else if (allStaff.length > 0) {
          const staffWithTasks = allStaff.find((s) => allTasks.some((t) => t.assignee_id === s.id));
          if (staffWithTasks) {
            setActiveAssigneeKey(staffWithTasks.id);
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Failed to load task operations: ' + msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkstationData();
  }, [currentStore.slug]);

  // Persist custom assignee tabs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`poshplex_task_assignee_tabs_${currentStore.slug}`, JSON.stringify(customAssigneeIds));
    } catch {
      // Ignore localStorage quotas
    }
  }, [customAssigneeIds, currentStore.slug]);

  // Compile list of available tabs (Logged in user + Task assignees + Custom tabs)
  const availableTabs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; role: string; count: number }>();

    // 1. Add current user
    if (currentUserId) {
      const me = staffList.find((s) => s.id === currentUserId);
      if (me) {
        map.set(me.id, {
          id: me.id,
          name: me.name || me.email,
          email: me.email,
          role: me.role,
          count: 0,
        });
      }
    }

    // 2. Add assignees from tasks
    tasks.forEach((t) => {
      if (t.assignee) {
        const existing = map.get(t.assignee_id);
        const name = `${t.assignee.first_name || ''} ${t.assignee.last_name || ''}`.trim() || t.assignee.email;
        if (!existing) {
          map.set(t.assignee_id, {
            id: t.assignee_id,
            name,
            email: t.assignee.email,
            role: t.assignee.role,
            count: 0,
          });
        }
      }
    });

    // 3. Add custom pinned staff tabs
    customAssigneeIds.forEach((id) => {
      if (!map.has(id)) {
        const staff = staffList.find((s) => s.id === id);
        if (staff) {
          map.set(id, {
            id: staff.id,
            name: staff.name || staff.email,
            email: staff.email,
            role: staff.role,
            count: 0,
          });
        }
      }
    });

    // Compute pending task count per assignee
    tasks.forEach((t) => {
      if (t.status === 'pending' && map.has(t.assignee_id)) {
        const item = map.get(t.assignee_id)!;
        item.count += 1;
      }
    });

    return Array.from(map.values());
  }, [tasks, staffList, currentUserId, customAssigneeIds]);

  // Filter tasks based on active assignee tab and category filter
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchAssignee = activeAssigneeKey === 'all' || t.assignee_id === activeAssigneeKey;
      const matchCategory = selectedCategoryFilter === 'all' || t.category_id === selectedCategoryFilter;
      return matchAssignee && matchCategory;
    });
  }, [tasks, activeAssigneeKey, selectedCategoryFilter]);

  const pendingTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'pending'), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'completed'), [filteredTasks]);

  // Total pending count across all tasks
  const totalPendingAcrossAll = useMemo(() => tasks.filter((t) => t.status === 'pending').length, [tasks]);

  // Handlers
  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategoryId(categories[0]?.id || '');
    setFormAssigneeId(activeAssigneeKey !== 'all' ? activeAssigneeKey : currentUserId || staffList[0]?.id || '');
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (task: StoreTask) => {
    setTargetTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormCategoryId(task.category_id || '');
    setFormAssigneeId(task.assignee_id);
    setIsEditModalOpen(true);
  };

  const handleOpenCompleteModal = (task: StoreTask) => {
    setTargetTask(task);
    setFormCompletionComment('');
    setIsCompleteModalOpen(true);
  };

  const handleSaveCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Task title is required.');
      return;
    }
    if (!formAssigneeId) {
      alert('Assignee staff member is required.');
      return;
    }

    setSubmittingForm(true);
    try {
      await createStoreTask({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category_id: formCategoryId || undefined,
        assignee_id: formAssigneeId,
      });
      setFeedback({ type: 'success', message: `Task "${formTitle}" successfully delegated.` });
      setIsCreateModalOpen(false);
      await loadWorkstationData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Failed to create task: ' + msg);
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleSaveUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTask) return;
    if (!formTitle.trim()) {
      alert('Task title is required.');
      return;
    }

    setSubmittingForm(true);
    try {
      await updateStoreTask(targetTask.id, {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category_id: formCategoryId || undefined,
        assignee_id: formAssigneeId,
      });
      setFeedback({ type: 'success', message: `Task "${formTitle}" updated.` });
      setIsEditModalOpen(false);
      await loadWorkstationData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Failed to update task: ' + msg);
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleSaveCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTask) return;
    if (!formCompletionComment.trim()) {
      alert('Completion comment / proof note is required for internal accountability.');
      return;
    }

    setSubmittingForm(true);
    try {
      await completeStoreTask(targetTask.id, {
        completion_comment: formCompletionComment.trim(),
      });
      setFeedback({
        type: 'success',
        message: `Task "${targetTask.title}" marked complete & logged in audit history.`,
      });
      setIsCompleteModalOpen(false);
      await loadWorkstationData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Failed to complete task: ' + msg);
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleDeleteTask = async (task: StoreTask) => {
    if (!confirm(`Are you sure you want to permanently delete task "${task.title}"?`)) return;
    try {
      await deleteStoreTask(task.id);
      setFeedback({ type: 'success', message: `Task "${task.title}" deleted.` });
      await loadWorkstationData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Failed to delete task: ' + msg });
    }
  };

  const handleAddAssigneeTab = (staffId: string) => {
    if (!customAssigneeIds.includes(staffId)) {
      setCustomAssigneeIds((prev) => [...prev, staffId]);
    }
    setActiveAssigneeKey(staffId);
    setIsAssigneeModalOpen(false);
  };

  const handleRemoveCustomTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCustomAssigneeIds((prev) => prev.filter((item) => item !== id));
    if (activeAssigneeKey === id) {
      setActiveAssigneeKey('all');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      alert('Category name is required.');
      return;
    }
    setSubmittingForm(true);
    try {
      await createTaskCategory({
        name: newCategoryName.trim(),
        color: newCategoryColor || '#3b82f6',
      });
      setFeedback({ type: 'success', message: `Category "${newCategoryName}" created.` });
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      const updatedCats = await fetchTaskCategories();
      setCategories(updatedCats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Failed to create category: ' + msg);
    } finally {
      setSubmittingForm(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: '#0f172a' }}>
      {/* Workstation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <CheckSquare size={22} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Task Management Workstation
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            Collaborative operational delegation, personal assignee queues, and verified completion auditing for {currentStore.name}.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={loadWorkstationData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsCategoryModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <Tag size={14} />
            <span>+ Department Tag</span>
          </button>

          <button
            onClick={() => setIsAssigneeModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <User size={14} />
            <span>+ Assignee Tab</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
            }}
          >
            <Plus size={16} />
            <span>Assign New Task</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Staff Assignee Workspace Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {/* All Assignees View */}
        <button
          onClick={() => setActiveAssigneeKey('all')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeAssigneeKey === 'all' ? '2px solid #0f172a' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeAssigneeKey === 'all' ? 700 : 500,
            color: activeAssigneeKey === 'all' ? '#0f172a' : '#64748b',
            whiteSpace: 'nowrap',
          }}
        >
          <Layers size={15} />
          <span>All Assignees</span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: activeAssigneeKey === 'all' ? '#0f172a' : '#f1f5f9',
              color: activeAssigneeKey === 'all' ? '#ffffff' : '#64748b',
            }}
          >
            {totalPendingAcrossAll}
          </span>
        </button>

        {/* Dynamic Individual Assignee Tabs */}
        {availableTabs.map((tab) => {
          const isSelected = activeAssigneeKey === tab.id;
          const isCurrentUser = tab.id === currentUserId;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveAssigneeKey(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                borderBottom: isSelected ? '2px solid #0f172a' : '2px solid transparent',
                marginBottom: '-2px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? '#0f172a' : '#64748b',
                whiteSpace: 'nowrap',
              }}
            >
              <User size={15} style={{ color: isCurrentUser ? '#3b82f6' : 'inherit' }} />
              <span>{tab.name} {isCurrentUser ? '(You)' : ''}</span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: tab.count > 0 ? (isSelected ? '#ef4444' : '#fee2e2') : '#f1f5f9',
                  color: tab.count > 0 ? (isSelected ? '#ffffff' : '#b91c1c') : '#64748b',
                }}
              >
                {tab.count}
              </span>

              {/* Removable custom tab close button */}
              {customAssigneeIds.includes(tab.id) && !isCurrentUser && (
                <span
                  onClick={(e) => handleRemoveCustomTab(e, tab.id)}
                  style={{
                    marginLeft: '4px',
                    padding: '2px',
                    borderRadius: '50%',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Remove Tab from View"
                >
                  <X size={12} />
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Add Tab Button */}
        <button
          onClick={() => setIsAssigneeModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            border: '1px dashed #cbd5e1',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            color: '#64748b',
            whiteSpace: 'nowrap',
            marginLeft: '4px',
          }}
        >
          <Plus size={13} />
          <span>Tab</span>
        </button>
      </div>

      {/* Category Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          backgroundColor: '#ffffff',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569', marginRight: '6px' }}>
          <Filter size={14} />
          <span>Department Filter:</span>
        </div>

        <button
          onClick={() => setSelectedCategoryFilter('all')}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: selectedCategoryFilter === 'all' ? '#0f172a' : '#f1f5f9',
            color: selectedCategoryFilter === 'all' ? '#ffffff' : '#64748b',
          }}
        >
          All Departments
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryFilter(cat.id)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: selectedCategoryFilter === cat.id ? cat.color : '#f8fafc',
              color: selectedCategoryFilter === cat.id ? '#ffffff' : '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: selectedCategoryFilter === cat.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: selectedCategoryFilter === cat.id ? '#ffffff' : cat.color,
              }}
            />
            <span>{cat.name}</span>
            <span style={{ opacity: 0.85, fontSize: '11px' }}>({cat.task_count})</span>
          </button>
        ))}
      </div>

      {/* SECTION 1: PENDING ACTIONABLE TASKS */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1e293b' }}>
              Pending Tasks ({pendingTasks.length} Actionable)
            </h2>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Audited completion required with proof note
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#64748b' }} />
            <div style={{ fontSize: '13px', color: '#64748b' }}>Loading operational tasks...</div>
          </div>
        ) : pendingTasks.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
            }}
          >
            <CheckCircle2 size={36} style={{ color: '#22c55e', margin: '0 auto 12px auto' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
              All clear! No pending tasks in this view.
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Assign a new action item or select another staff tab to inspect work queues.
            </p>
            <button
              onClick={handleOpenCreateModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>Assign New Task</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                }}
              >
                {/* Task Top Meta Line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {task.category && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: `${task.category.color}18`,
                          color: task.category.color,
                          border: `1px solid ${task.category.color}35`,
                        }}
                      >
                        <Tag size={11} />
                        {task.category.name}
                      </span>
                    )}

                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                      {task.title}
                    </h3>
                  </div>

                  {/* Actions Dock */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleOpenCompleteModal(task)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>Mark Complete ✔</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(task)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                      title="Edit Task"
                    >
                      <Edit2 size={13} />
                    </button>

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteTask(task)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                        title="Delete Task"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {task.description && (
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                    {task.description}
                  </p>
                )}

                {/* Footer Attribution Line */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#64748b',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '10px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <User size={13} style={{ color: '#3b82f6' }} />
                      <span>Assignee: <strong>{task.assignee.first_name || task.assignee.email}</strong></span>
                    </span>

                    {task.created_by && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span>Delegated by: <strong>{task.created_by.first_name || task.created_by.email}</strong></span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    <Clock size={12} />
                    <span>Assigned: {formatDate(task.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: COMPLETED TASKS AUDIT ARCHIVE */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setIsArchiveExpanded((prev) => !prev)}
          style={{
            width: '100%',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              Completed Tasks Archive ({completedTasks.length} Historical Records)
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
            <span>{isArchiveExpanded ? 'Collapse' : 'Expand'}</span>
            {isArchiveExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {isArchiveExpanded && (
          <div style={{ padding: '16px 20px' }}>
            {completedTasks.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No completed tasks found for this view.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                          }}
                        >
                          COMPLETED
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{task.title}</span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                        Finished: {formatDate(task.completed_at)}
                      </div>
                    </div>

                    {/* Completion Audit Comment */}
                    {task.completion_comment && (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          borderLeft: '3px solid #10b981',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#334155',
                          marginBottom: '8px',
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', marginBottom: '2px' }}>
                          Proof / Audit Note:
                        </div>
                        {task.completion_comment}
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '16px' }}>
                      <span>Assignee: {task.assignee.first_name || task.assignee.email}</span>
                      {task.created_by && <span>Delegated by: {task.created_by.first_name || task.created_by.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: ASSIGN NEW TASK */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Assign New Operational Task
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} style={{ color: '#64748b' }} />
              </button>
            </div>

            <form onSubmit={handleSaveCreateTask} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Double check barcode stickers for drop #03"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Department / Category
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="">Unassigned Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Assignee Staff Member *
                  </label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="">Select Staff...</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.email} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Detailed Instructions & Operational Context
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  placeholder="Detail physical rack locations, specific order PO numbers, customer alternate phones, or expected deliverables..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: submittingForm ? 'not-allowed' : 'pointer' }}
                >
                  {submittingForm ? 'Assigning...' : 'Assign Task & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: COMPLETE TASK WITH AUDIT PROOF */}
      {isCompleteModalOpen && targetTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f0fdf4',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#14532d' }}>
                  Audited Task Completion
                </h3>
              </div>
              <button onClick={() => setIsCompleteModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} style={{ color: '#64748b' }} />
              </button>
            </div>

            <form onSubmit={handleSaveCompleteTask} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Completing task:</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{targetTask.title}</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Completion Proof & Internal Audit Comment *
                </label>
                <textarea
                  value={formCompletionComment}
                  onChange={(e) => setFormCompletionComment(e.target.value)}
                  rows={4}
                  required
                  placeholder="e.g. Customer contacted and confirmed PO-2891 delivery. Steadfast tracking # 82910 verified and parcel dispatched from hub."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
                  <strong>Audit Requirement:</strong> This proof note will be permanently archived in the store history alongside your staff account stamp and completion timestamp.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: submittingForm ? 'not-allowed' : 'pointer' }}
                >
                  {submittingForm ? 'Submitting...' : 'Confirm & Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT TASK */}
      {isEditModalOpen && targetTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Edit Task Details
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} style={{ color: '#64748b' }} />
              </button>
            </div>

            <form onSubmit={handleSaveUpdateTask} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Department / Category
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="">Unassigned Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Assignee Staff Member *
                  </label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Detailed Instructions & Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: submittingForm ? 'not-allowed' : 'pointer' }}
                >
                  {submittingForm ? 'Saving...' : 'Update Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD ASSIGNEE TAB */}
      {isAssigneeModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Add Assignee Workspace Tab
              </h3>
              <button onClick={() => setIsAssigneeModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} style={{ color: '#64748b' }} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Select a staff member from the active registry to pin their personal task queue to your top tab bar.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {staffList.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleAddAssigneeTab(s.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                      backgroundColor: customAssigneeIds.includes(s.id) ? '#f8fafc' : '#ffffff',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                        {s.name || s.email}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.email} • {s.role}</div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>Pin Tab &rarr;</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '18px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setIsAssigneeModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CREATE CATEGORY */}
      {isCategoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Create Operational Department Tag
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} style={{ color: '#64748b' }} />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Department Name *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Fabric Sourcing, Photoshoot Runway"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Badge Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    style={{ width: '120px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: submittingForm ? 'not-allowed' : 'pointer' }}
                >
                  {submittingForm ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
