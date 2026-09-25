<script setup>
import { ref, onMounted } from 'vue'
import { roleService } from '@/services/roleService'
import { authService } from '@/services/authService'
import { permissionsService } from '@/services/permissionsService'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'

defineOptions({ name: 'RoleManagementView' })

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]
const ASSIGNABLE_ROLES = ['student', 'teacher', 'admin', 'super_admin']

// Per-user feature toggles — the pages this covers (see
// lms-backend/src/utils/permissions.js). Deliberately excludes Student
// Management / Roles & Permissions themselves, which stay strictly
// role-gated.
const FEATURE_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'latex_to_text', label: 'LaTeX to Text' },
  { key: 'trim_video', label: 'Trim Video' },
  { key: 'compress_video', label: 'Compress Video' },
]

const myId = authService.getCurrentUser()?.id
const isSuperAdmin = authService.getCurrentUser()?.role === 'super_admin'
// Only a super admin may view/edit another admin's or super_admin's
// permissions — matches the backend check in admin.routes.js.
const canManagePermissions = (targetRole) => isSuperAdmin || !['admin', 'super_admin'].includes(targetRole)

const users = ref([])
const loading = ref(false)
const listError = ref('')
const search = ref('')
const roleFilter = ref('')
const page = ref(1)
const limit = ref(20)
const pagination = ref({ page: 1, limit: 20, total: 0, total_pages: 1 })

// Per-row pending role selection + save state, keyed by user id — lets one
// row save without disturbing the others.
const pendingRole = ref({})
const savingId = ref(null)
const rowError = ref({})

const fetchUsers = async () => {
  loading.value = true
  listError.value = ''
  try {
    const res = await roleService.listUsers({
      search: search.value.trim() || undefined,
      role: roleFilter.value || undefined,
      page: page.value,
      limit: limit.value,
    })
    users.value = res.users
    pagination.value = res.pagination
    pendingRole.value = Object.fromEntries(res.users.map(u => [u.id, u.role]))
  } catch (err) {
    listError.value = err.response?.data?.error || err.message || 'Failed to load accounts.'
  } finally {
    loading.value = false
  }
}

let searchTimer = null
const onSearchInput = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; fetchUsers() }, 350)
}

const changePage = (p) => {
  if (p < 1 || p > pagination.value.total_pages) return
  page.value = p
  fetchUsers()
}

const saveRole = async (user) => {
  const nextRole = pendingRole.value[user.id]
  if (nextRole === user.role) return
  const label = ROLE_OPTIONS.find(r => r.value === nextRole)?.label || nextRole
  if (!window.confirm(`Change ${user.name}'s role to "${label}"?`)) {
    pendingRole.value[user.id] = user.role
    return
  }
  savingId.value = user.id
  rowError.value[user.id] = ''
  try {
    const updated = await roleService.updateRole(user.id, nextRole)
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx !== -1 && updated) users.value[idx] = updated
  } catch (err) {
    rowError.value[user.id] = err.response?.data?.error || err.message || 'Failed to update role.'
    pendingRole.value[user.id] = user.role
  } finally {
    savingId.value = null
  }
}

const toggleActive = async (user) => {
  savingId.value = user.id
  rowError.value[user.id] = ''
  try {
    const updated = await roleService.updateUser(user.id, { is_active: !user.is_active })
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx !== -1 && updated) users.value[idx] = updated
  } catch (err) {
    rowError.value[user.id] = err.response?.data?.error || err.message || 'Failed to update account.'
  } finally {
    savingId.value = null
  }
}

// ── New account ──────────────────────────────────────────────────────────
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const form = ref({ name: '', email: '', phone: '', password: '', role: 'admin' })

const openCreateModal = () => {
  form.value = { name: '', email: '', phone: '', password: '', role: 'admin' }
  createError.value = ''
  showCreateModal.value = true
}
const closeCreateModal = () => {
  if (creating.value) return
  showCreateModal.value = false
}
const submitCreate = async () => {
  creating.value = true
  createError.value = ''
  try {
    await roleService.createUser({ ...form.value })
    showCreateModal.value = false
    page.value = 1
    await fetchUsers()
  } catch (err) {
    createError.value = err.response?.data?.error || err.message || 'Failed to create account.'
  } finally {
    creating.value = false
  }
}

// ── Per-user permissions ────────────────────────────────────────────────
const showPermModal = ref(false)
const permUser = ref(null)
const permLoading = ref(false)
const permError = ref('')
const permSaving = ref(false)
// featureKey -> 'default' | 'allow' | 'deny', seeded from the effective map
const permState = ref({})

const openPermissions = async (user) => {
  permUser.value = user
  permError.value = ''
  permState.value = {}
  showPermModal.value = true
  permLoading.value = true
  try {
    const res = await permissionsService.getUserPermissions(user.id)
    const perms = res?.permissions || {}
    permState.value = Object.fromEntries(FEATURE_OPTIONS.map(({ key }) => [
      key,
      !perms[key]?.overridden ? 'default' : (perms[key].allowed ? 'allow' : 'deny')
    ]))
  } catch (err) {
    permError.value = err.response?.data?.error || err.message || 'Failed to load permissions.'
  } finally {
    permLoading.value = false
  }
}
const closePermissions = () => {
  if (permSaving.value) return
  showPermModal.value = false
  permUser.value = null
}
const savePermissions = async () => {
  if (!permUser.value) return
  permSaving.value = true
  permError.value = ''
  try {
    const updates = Object.fromEntries(FEATURE_OPTIONS.map(({ key }) => [
      key,
      permState.value[key] === 'allow' ? true : permState.value[key] === 'deny' ? false : null
    ]))
    await permissionsService.updateUserPermissions(permUser.value.id, updates)
    // The signed-in admin might be editing their own account (e.g. a
    // super_admin adjusting their own toggles) — refresh the cached "mine"
    // map so the sidebar reflects it without a manual reload.
    if (permUser.value.id === myId) permissionsService.clearCache()
    showPermModal.value = false
    permUser.value = null
  } catch (err) {
    permError.value = err.response?.data?.error || err.message || 'Failed to save permissions.'
  } finally {
    permSaving.value = false
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <Breadcrumb :items="[{ label: 'Roles & Permissions' }, { label: 'Roles' }]" />
        </template>
      </Header>

      <main class="p-6 sm:p-8 flex-1 w-full">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 class="text-xl font-extrabold text-slate-900 dark:text-white">Roles</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {{ isSuperAdmin ? "Manage every account's role, status and page access." : "Manage page access for teachers and students." }}
            </p>
          </div>
          <button
            v-if="isSuperAdmin"
            @click="openCreateModal"
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95"
          >
            <span class="text-sm font-normal leading-none">+</span> New Account
          </button>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-3 mb-5">
          <input
            v-model="search"
            @input="onSearchInput"
            type="text"
            placeholder="Search name, email or phone..."
            class="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            v-model="roleFilter"
            @change="page = 1; fetchUsers()"
            class="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option v-for="r in ROLE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>

        <div v-if="loading" class="text-center py-10 text-slate-500 font-medium">Loading accounts...</div>
        <div v-else-if="listError" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">{{ listError }}</div>
        <div v-else-if="users.length === 0" class="text-center py-10 text-slate-500">No accounts match.</div>

        <div v-else class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <table class="w-full text-left">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th class="px-4 py-3">Name</th>
                <th class="px-4 py-3">Contact</th>
                <th class="px-4 py-3">Role</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="user in users" :key="user.id">
                <td class="px-4 py-3">
                  <p class="text-xs font-bold text-slate-900 dark:text-white">{{ user.name }}</p>
                  <p v-if="user.id === myId" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">You</p>
                </td>
                <td class="px-4 py-3">
                  <p class="text-[11px] text-slate-600 dark:text-slate-400">{{ user.email || '—' }}</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-500">{{ user.phone || '' }}</p>
                </td>
                <td class="px-4 py-3">
                  <select
                    v-if="isSuperAdmin"
                    v-model="pendingRole[user.id]"
                    @change="saveRole(user)"
                    :disabled="savingId === user.id || user.id === myId"
                    class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option v-for="r in ASSIGNABLE_ROLES" :key="r" :value="r">{{ r }}</option>
                  </select>
                  <span v-else class="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{{ user.role.replace('_', ' ') }}</span>
                  <p v-if="rowError[user.id]" class="text-[10px] text-red-600 mt-1">{{ rowError[user.id] }}</p>
                </td>
                <td class="px-4 py-3">
                  <button
                    @click="toggleActive(user)"
                    :disabled="savingId === user.id"
                    :class="[
                      'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide disabled:opacity-50 cursor-pointer',
                      user.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    ]"
                  >
                    {{ user.is_active ? 'Active' : 'Disabled' }}
                  </button>
                </td>
                <td class="px-4 py-3 text-right">
                  <span v-if="savingId === user.id" class="text-[11px] text-slate-400">Saving...</span>
                  <button
                    v-else-if="canManagePermissions(user.role)"
                    @click="openPermissions(user)"
                    class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Permissions
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="pagination.total_pages > 1" class="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <span>Page {{ pagination.page }} of {{ pagination.total_pages }} · {{ pagination.total }} accounts</span>
            <div class="flex gap-2">
              <button @click="changePage(page - 1)" :disabled="page <= 1" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 cursor-pointer">Prev</button>
              <button @click="changePage(page + 1)" :disabled="page >= pagination.total_pages" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 cursor-pointer">Next</button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- NEW ACCOUNT MODAL -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="closeCreateModal"
    >
      <div class="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-5">New account</h2>

        <div class="space-y-3.5">
          <div>
            <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Name</label>
            <input v-model="form.name" type="text" :disabled="creating" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            <input v-model="form.email" type="email" :disabled="creating" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Phone (optional)</label>
            <input v-model="form.phone" type="text" :disabled="creating" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
            <input v-model="form.password" type="password" :disabled="creating" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
            <select v-model="form.role" :disabled="creating" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
              <option v-for="r in ASSIGNABLE_ROLES" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
        </div>

        <p v-if="createError" class="text-xs text-red-600 mt-4">{{ createError }}</p>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="closeCreateModal" :disabled="creating" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-50 cursor-pointer">Cancel</button>
          <button @click="submitCreate" :disabled="creating" class="px-5 py-2.5 rounded-xl bg-[#006A3A] text-white font-semibold text-sm hover:bg-[#005A31] disabled:opacity-50 cursor-pointer">
            {{ creating ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- PERMISSIONS MODAL -->
    <div
      v-if="showPermModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="closePermissions"
    >
      <div class="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">Page access</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-5">
          {{ permUser?.name }} · <span class="capitalize">{{ permUser?.role?.replace('_', ' ') }}</span>
        </p>

        <div v-if="permLoading" class="text-center py-6 text-slate-500 text-sm">Loading...</div>
        <div v-else class="space-y-3.5">
          <div v-for="feature in FEATURE_OPTIONS" :key="feature.key" class="flex items-center justify-between gap-3">
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">{{ feature.label }}</span>
            <select
              v-model="permState[feature.key]"
              :disabled="permSaving"
              class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="default">Default (role)</option>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </div>
        </div>

        <p v-if="permError" class="text-xs text-red-600 mt-4">{{ permError }}</p>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="closePermissions" :disabled="permSaving" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-50 cursor-pointer">Cancel</button>
          <button @click="savePermissions" :disabled="permSaving || permLoading" class="px-5 py-2.5 rounded-xl bg-[#006A3A] text-white font-semibold text-sm hover:bg-[#005A31] disabled:opacity-50 cursor-pointer">
            {{ permSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
