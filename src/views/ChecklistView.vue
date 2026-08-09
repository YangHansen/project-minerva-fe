<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, CalendarDays, Check, Edit3, Folder, Globe2, Plus, Trash2, X } from 'lucide-vue-next'
import type { ChecklistItem } from '../types'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'

const { checklist, selectedId, scholarshipNotes, addChecklistItem, updateChecklistItem, deleteChecklistItem, saveScholarshipNotes, toast } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const days = computed(() => selected.value ? Math.max(0, Math.ceil((new Date(selected.value.deadline).getTime() - Date.now()) / 86400000)) : 0)
const notesEditing = ref(false)
const notesDraft = ref('')
const startNotes = () => { notesDraft.value = selectedId.value ? scholarshipNotes.value[selectedId.value] || '' : ''; notesEditing.value = true }
const saveNotes = () => {
  if (!selectedId.value) return
  saveScholarshipNotes(selectedId.value, notesDraft.value.trim())
  notesEditing.value = false
  toast('Scholarship notes saved.')
}

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<{ title: string; description: string }>({ title: '', description: '' })
const openCreate = () => { editingId.value = null; form.value = { title: '', description: '' }; modalOpen.value = true }
const openEdit = (item: ChecklistItem) => { editingId.value = item.id; form.value = { title: item.title, description: item.description }; modalOpen.value = true }
const closeModal = () => { modalOpen.value = false }
const saveTask = () => {
  if (!selectedId.value || !form.value.title.trim()) return
  if (editingId.value) {
    const item = checklist.value.find((entry) => entry.id === editingId.value)
    if (item) { Object.assign(item, { title: form.value.title.trim(), description: form.value.description.trim() }); updateChecklistItem(item) }
    toast('Checklist item updated.')
  } else {
    addChecklistItem(selectedId.value, { title: form.value.title.trim(), description: form.value.description.trim(), status: 'pending', category: 'Custom', required: true, notes: '' })
    toast('Checklist item added.')
  }
  closeModal()
}
const removeTask = (item: ChecklistItem) => {
  if (!selectedId.value || !window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
  deleteChecklistItem(selectedId.value, item.id)
  toast('Checklist item deleted.', 'info')
}
const toggleTask = (item: ChecklistItem) => {
  item.status = item.status === 'done' ? 'pending' : 'done'
  updateChecklistItem(item)
  toast(item.status === 'done' ? 'Task completed.' : 'Task reopened.', 'info')
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
          <RouterLink :to="`/dashboard/${selected.id}`" class="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#5b45f5]"><ArrowLeft :size="16" />Back to My Scholarships</RouterLink>
          <header class="workspace-scholar-head">
            <div><p class="workspace-kicker">Active scholarship</p><h1>{{ selected.name }}</h1><p>{{ selected.provider }} · {{ selected.country }}</p><div class="scholarship-tags"><span><Globe2 :size="13" />{{ selected.country }}</span><span>{{ selected.fundingType }}</span></div></div>
            <div class="deadline-card"><span>Deadline</span><strong><CalendarDays :size="17" />{{ selected.deadline }}</strong><small>{{ days }} days left</small></div>
          </header>

          <section class="scholarship-notes-card">
            <div class="notes-title"><h2>Notes</h2><button v-if="!notesEditing" aria-label="Edit scholarship notes" @click="startNotes"><Edit3 :size="20" /></button></div>
            <template v-if="notesEditing"><textarea v-model="notesDraft" autofocus placeholder="Add priorities, official requirements, and reminders for this scholarship." /><div class="notes-actions"><button class="btn-secondary" @click="notesEditing = false">Cancel</button><button class="btn-primary" @click="saveNotes"><Check :size="16" />Save notes</button></div></template>
            <template v-else><p>{{ scholarshipNotes[selected.id] || 'Add priorities, official requirements, and reminders for this scholarship.' }}</p></template>
          </section>

          <div class="checklist-toolbar"><div><p class="workspace-muted-label">Application tasks</p><span>Keep every task for this scholarship in one simple list.</span></div><button class="btn-primary" @click="openCreate"><Plus :size="17" />Add task</button></div>

          <section class="task-status-section">
            <div class="task-section-title"><h2>Tasks</h2><span>{{ checklist.length }}</span></div>
            <div v-if="checklist.length" class="task-list">
              <article v-for="item in checklist" :key="item.id" class="task-row" :class="item.status === 'done' && 'bg-slate-50 opacity-70'">
                <button class="task-state-dot" :class="item.status === 'done' && 'done'" :aria-label="item.status === 'done' ? `Mark ${item.title} as not done` : `Mark ${item.title} as done`" @click="toggleTask(item)"><Check v-if="item.status === 'done'" :size="14" /></button>
                <div><h3 :class="item.status === 'done' && 'text-slate-400 line-through'">{{ item.title }}</h3><p :class="item.status === 'done' && 'text-slate-400 line-through'">{{ item.description }}</p></div>
                <div class="task-actions"><button :aria-label="`Edit ${item.title}`" @click="openEdit(item)"><Edit3 :size="19" /></button><button class="delete" :aria-label="`Delete ${item.title}`" @click="removeTask(item)"><Trash2 :size="19" /></button></div>
              </article>
            </div>
            <div v-else class="task-empty">No tasks yet. Add your first task for this scholarship.</div>
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
          <div class="workspace-modal-actions"><button type="button" class="btn-secondary" @click="closeModal">Cancel</button><button class="btn-primary" type="submit">Save changes</button></div>
        </form>
      </div>
    </Transition>
  </main>
</template>
