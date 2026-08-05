<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarDays, Check, Edit3, Folder, Globe2, Plus, Trash2, X } from 'lucide-vue-next'
import type { ChecklistItem, ChecklistStatus } from '../types'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'

const { checklist, progress, selectedId, scholarshipNotes, addChecklistItem, deleteChecklistItem, toast } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const days = computed(() => selected.value ? Math.max(0, Math.ceil((new Date(selected.value.deadline).getTime() - Date.now()) / 86400000)) : 0)
const statusSections: Array<{ id: ChecklistStatus; label: string }> = [
  { id: 'pending', label: 'Pending' }, { id: 'in_progress', label: 'In Progress' }, { id: 'done', label: 'Done' },
]
const tasksFor = (status: ChecklistStatus) => checklist.value.filter((item) => item.status === status)

const notesEditing = ref(false)
const notesDraft = ref('')
const startNotes = () => { notesDraft.value = selectedId.value ? scholarshipNotes.value[selectedId.value] || '' : ''; notesEditing.value = true }
const saveNotes = () => {
  if (!selectedId.value) return
  scholarshipNotes.value[selectedId.value] = notesDraft.value.trim()
  notesEditing.value = false
  toast('Scholarship notes saved.')
}

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<{ title: string; description: string; status: ChecklistStatus }>({ title: '', description: '', status: 'pending' })
const openCreate = () => { editingId.value = null; form.value = { title: '', description: '', status: 'pending' }; modalOpen.value = true }
const openEdit = (item: ChecklistItem) => { editingId.value = item.id; form.value = { title: item.title, description: item.description, status: item.status }; modalOpen.value = true }
const closeModal = () => { modalOpen.value = false }
const saveTask = () => {
  if (!selectedId.value || !form.value.title.trim()) return
  if (editingId.value) {
    const item = checklist.value.find((entry) => entry.id === editingId.value)
    if (item) Object.assign(item, { title: form.value.title.trim(), description: form.value.description.trim(), status: form.value.status })
    toast('Checklist item updated.')
  } else {
    addChecklistItem(selectedId.value, { title: form.value.title.trim(), description: form.value.description.trim(), status: form.value.status, category: 'Custom', required: true, notes: '' })
    toast('Checklist item added.')
  }
  closeModal()
}
const removeTask = (item: ChecklistItem) => {
  if (!selectedId.value || !window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
  deleteChecklistItem(selectedId.value, item.id)
  toast('Checklist item deleted.', 'info')
}
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="checklist" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Application checklist" subtitle="Every scholarship keeps its own requirements folder." />
      <div class="workspace-content">
        <section v-if="!selected" class="notion-select-state">
          <div class="notion-select-icon"><Folder :size="31" /></div><h1>Select a scholarship first</h1>
          <p>Choose a saved scholarship before managing its private application checklist.</p>
          <RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink>
        </section>

        <section v-else class="checklist-workspace">
          <header class="workspace-scholar-head">
            <div><p class="workspace-kicker">Active scholarship</p><h1>{{ selected.name }}</h1><p>{{ selected.provider }} · {{ selected.country }}</p><div class="scholarship-tags"><span><Globe2 :size="13" />{{ selected.country }}</span><span>{{ selected.fundingType }}</span></div></div>
            <div class="deadline-card"><span>Deadline</span><strong><CalendarDays :size="17" />{{ selected.deadline }}</strong><small>{{ days }} days left</small></div>
          </header>

          <div class="checklist-progress-strip"><span>{{ checklist.filter((item) => item.status === 'done').length }} of {{ checklist.length }} requirements ready</span><strong>{{ progress }}%</strong><div><i :style="{ width: `${progress}%` }" /></div></div>

          <section class="scholarship-notes-card">
            <div class="notes-title"><h2>Notes</h2><button v-if="!notesEditing" aria-label="Edit scholarship notes" @click="startNotes"><Edit3 :size="20" /></button></div>
            <template v-if="notesEditing"><textarea v-model="notesDraft" autofocus placeholder="Add priorities, official requirements, and reminders for this scholarship." /><div class="notes-actions"><button class="btn-secondary" @click="notesEditing = false">Cancel</button><button class="btn-primary" @click="saveNotes"><Check :size="16" />Save notes</button></div></template>
            <template v-else><p>{{ scholarshipNotes[selected.id] || 'Add priorities, official requirements, and reminders for this scholarship.' }}</p></template>
          </section>

          <div class="checklist-toolbar"><div><p class="workspace-muted-label">Application tasks</p><span>Move each requirement through your workflow.</span></div><button class="btn-primary" @click="openCreate"><Plus :size="17" />Add task</button></div>

          <section v-for="section in statusSections" :key="section.id" class="task-status-section">
            <div class="task-section-title"><h2>{{ section.label }}</h2><span>{{ tasksFor(section.id).length }}</span></div>
            <div v-if="tasksFor(section.id).length" class="task-list">
              <article v-for="item in tasksFor(section.id)" :key="item.id" class="task-row">
                <button class="task-state-dot" :class="item.status" :aria-label="`Change status for ${item.title}`" @click="item.status = item.status === 'pending' ? 'in_progress' : item.status === 'in_progress' ? 'done' : 'pending'"><Check v-if="item.status === 'done'" :size="14" /></button>
                <div><h3>{{ item.title }}</h3><p>{{ item.description }}</p></div>
                <span class="notion-pill" :class="item.required ? 'required' : 'optional'">{{ item.required ? 'Required' : 'Optional' }}</span>
                <div class="task-actions"><button :aria-label="`Edit ${item.title}`" @click="openEdit(item)"><Edit3 :size="19" /></button><button class="delete" :aria-label="`Delete ${item.title}`" @click="removeTask(item)"><Trash2 :size="19" /></button></div>
              </article>
            </div>
            <div v-else class="task-empty">No tasks in {{ section.label.toLowerCase() }}.</div>
          </section>
        </section>
      </div>
    </div>

    <Transition name="modal">
      <div v-if="modalOpen" class="workspace-modal-backdrop" @click.self="closeModal">
        <form class="workspace-modal" @submit.prevent="saveTask">
          <div class="workspace-modal-title"><div><p class="workspace-kicker">Checklist editor</p><h2>{{ editingId ? `Edit ${form.title || 'task'}` : 'Add checklist item' }}</h2></div><button type="button" aria-label="Close" @click="closeModal"><X :size="20" /></button></div>
          <label class="field-label">Item title<input v-model="form.title" class="field" required placeholder="e.g. Upload passport copy" /></label>
          <label class="field-label">Description<textarea v-model="form.description" class="field min-h-28 resize-y" placeholder="Describe what must be completed." /></label>
          <label class="field-label">Status<select v-model="form.status" class="field"><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="done">Done</option></select></label>
          <div class="workspace-modal-actions"><button type="button" class="btn-secondary" @click="closeModal">Cancel</button><button class="btn-primary" type="submit">Save changes</button></div>
        </form>
      </div>
    </Transition>
  </main>
</template>
