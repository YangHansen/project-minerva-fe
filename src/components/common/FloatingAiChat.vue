<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AlertCircle, Bot, History, LoaderCircle, MessageCircle, Plus, RefreshCw, Send, Sparkles, Trash2, X } from 'lucide-vue-next'
import { ApiError, apiRequest } from '../../api'
import { useAppState } from '../../composables/useAppState'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
}

interface ChatThread {
  id: string
  title: string
  createdAt: string
  updatedAt?: string
  applicationId?: string
  messageCount: number
  messages: ChatMessage[]
}

type UnknownRecord = Record<string, unknown>

const { selectedId, backendApplicationIds, session, syncAiTokenBalance } = useAppState()
const open = ref(false)
const showHistory = ref(false)
const input = ref('')
const responding = ref(false)
const loadingThreads = ref(false)
const loadingThread = ref(false)
const loaded = ref(false)
const error = ref('')
const threads = ref<ChatThread[]>([])
const activeId = ref('')
const messageArea = ref<HTMLElement | null>(null)
const activeThread = computed(() => threads.value.find((thread) => thread.id === activeId.value) || null)
const activeApplicationId = computed(() => selectedId.value ? backendApplicationIds.value[selectedId.value] : undefined)
let accountGeneration = 0

const isCurrentAccount = (generation: number) => generation === accountGeneration

const asRecord = (value: unknown): UnknownRecord | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
)

const textValue = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === 'string' && item.trim())
  return typeof value === 'string' ? value : ''
}

const normalizeMessage = (value: unknown, fallbackRole: ChatMessage['role'] = 'assistant'): ChatMessage | null => {
  if (typeof value === 'string') {
    return { id: `message-${crypto.randomUUID()}`, role: fallbackRole, text: value, createdAt: new Date().toISOString() }
  }

  const raw = asRecord(value)
  if (!raw) return null
  const text = textValue(raw.text, raw.content, raw.reply, raw.answer)
  if (!text) return null
  return {
    id: textValue(raw.id, raw._id) || `message-${crypto.randomUUID()}`,
    role: raw.role === 'user' ? 'user' : 'assistant',
    text,
    createdAt: textValue(raw.createdAt, raw.created_at) || new Date().toISOString(),
  }
}

const normalizeThread = (value: unknown): ChatThread | null => {
  const raw = asRecord(value)
  if (!raw) return null
  const id = textValue(raw.id, raw._id, raw.threadId)
  if (!id) return null
  const rawMessages = Array.isArray(raw.messages) ? raw.messages : []
  const messages = rawMessages.map((message) => normalizeMessage(message)).filter((message): message is ChatMessage => Boolean(message))
  const count = typeof raw.messageCount === 'number' ? raw.messageCount : messages.length
  return {
    id,
    title: textValue(raw.title, raw.name) || 'New conversation',
    createdAt: textValue(raw.createdAt, raw.created_at) || new Date().toISOString(),
    updatedAt: textValue(raw.updatedAt, raw.updated_at) || undefined,
    applicationId: textValue(raw.applicationId, raw.application_id) || undefined,
    messageCount: count,
    messages,
  }
}

const arrayFrom = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload
  const raw = asRecord(payload)
  if (!raw) return []
  for (const key of keys) if (Array.isArray(raw[key])) return raw[key] as unknown[]
  const data = asRecord(raw.data)
  if (data) for (const key of keys) if (Array.isArray(data[key])) return data[key] as unknown[]
  return []
}

const objectFrom = (payload: unknown, keys: string[]) => {
  const raw = asRecord(payload)
  if (!raw) return null
  for (const key of keys) {
    const nested = asRecord(raw[key])
    if (nested) return nested
  }
  const data = asRecord(raw.data)
  if (data) {
    for (const key of keys) {
      const nested = asRecord(data[key])
      if (nested) return nested
    }
    return data
  }
  return raw
}

const userError = (caught: unknown) => caught instanceof ApiError
  ? caught.message
  : 'Minerva AI could not complete that request. Please try again.'

const scrollToLatest = async (generation = accountGeneration) => {
  await nextTick()
  if (!isCurrentAccount(generation)) return
  messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight, behavior: 'smooth' })
}

const loadThread = async (id: string, generation = accountGeneration) => {
  if (!isCurrentAccount(generation)) return
  loadingThread.value = true
  error.value = ''
  try {
    const payload = await apiRequest<unknown>(`/api/ai/chats/${encodeURIComponent(id)}`)
    if (!isCurrentAccount(generation)) return
    const thread = normalizeThread(objectFrom(payload, ['thread', 'chat']))
    if (!thread) throw new Error('Invalid chat response')
    const index = threads.value.findIndex((item) => item.id === id)
    if (index >= 0) {
      const currentThread = threads.value[index]
      threads.value[index] = {
        ...currentThread,
        ...thread,
        applicationId: thread.applicationId || currentThread.applicationId,
      }
    }
    else threads.value.unshift(thread)
    await scrollToLatest(generation)
  } catch (caught) {
    if (isCurrentAccount(generation)) error.value = userError(caught)
  } finally {
    if (isCurrentAccount(generation)) loadingThread.value = false
  }
}

const loadThreads = async () => {
  const generation = accountGeneration
  loadingThreads.value = true
  error.value = ''
  try {
    const payload = await apiRequest<unknown>('/api/ai/chats')
    if (!isCurrentAccount(generation)) return
    const applicationIdsByThread = new Map(threads.value.map((thread) => [thread.id, thread.applicationId]))
    threads.value = arrayFrom(payload, ['threads', 'chats'])
      .map((thread) => normalizeThread(thread))
      .filter((thread): thread is ChatThread => Boolean(thread))
      .map((thread) => ({
        ...thread,
        applicationId: thread.applicationId || applicationIdsByThread.get(thread.id),
      }))
    loaded.value = true
    if (activeId.value && !threads.value.some((thread) => thread.id === activeId.value)) activeId.value = ''
    if (!activeId.value && threads.value.length) activeId.value = threads.value[0].id
    if (activeId.value && !activeThread.value?.messages.length && activeThread.value?.messageCount) {
      await loadThread(activeId.value, generation)
    }
  } catch (caught) {
    if (isCurrentAccount(generation)) error.value = userError(caught)
  } finally {
    if (isCurrentAccount(generation)) loadingThreads.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen && !loaded.value && !loadingThreads.value && session.value) void loadThreads()
})
watch(() => session.value ? session.value.id || session.value.email : '', (nextId, previousId) => {
  if (nextId === previousId) return
  accountGeneration += 1
  open.value = false
  showHistory.value = false
  input.value = ''
  responding.value = false
  loadingThreads.value = false
  loadingThread.value = false
  loaded.value = false
  error.value = ''
  threads.value = []
  activeId.value = ''
}, { flush: 'sync' })

const newChat = () => {
  activeId.value = ''
  showHistory.value = false
  input.value = ''
  error.value = ''
}

const openThread = async (id: string) => {
  activeId.value = id
  showHistory.value = false
  error.value = ''
  await loadThread(id)
}

const deleteThread = async (id: string) => {
  const generation = accountGeneration
  error.value = ''
  try {
    await apiRequest(`/api/ai/chats/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!isCurrentAccount(generation)) return
    threads.value = threads.value.filter((thread) => thread.id !== id)
    if (activeId.value === id) activeId.value = threads.value[0]?.id || ''
  } catch (caught) {
    if (isCurrentAccount(generation)) error.value = userError(caught)
  }
}

const createThread = async (title: string, generation: number) => {
  const payload = await apiRequest<unknown>('/api/ai/chats', {
    method: 'POST',
    body: { title: title.slice(0, 60) },
  })
  if (!isCurrentAccount(generation)) return null
  const thread = normalizeThread(objectFrom(payload, ['thread', 'chat']))
  if (!thread) throw new Error('Invalid chat response')
  threads.value.unshift(thread)
  activeId.value = thread.id
  return thread
}

const replyFrom = (payload: unknown) => {
  const raw = asRecord(payload)
  if (!raw) return normalizeMessage(payload)
  const nested = objectFrom(payload, ['assistantMessage', 'message', 'reply'])
  const normalized = normalizeMessage(nested)
  if (normalized) return normalized
  return normalizeMessage(raw.content ?? raw.text ?? raw.answer ?? raw.reply)
}

const send = async () => {
  const text = input.value.trim()
  if (!text || responding.value) return

  const generation = accountGeneration
  const selectedApplicationId = activeApplicationId.value
  responding.value = true
  error.value = ''
  input.value = ''
  let thread = activeThread.value
  let optimisticId = ''

  try {
    if (!thread) thread = await createThread(text, generation)
    if (!thread || !isCurrentAccount(generation)) return
    const applicationId = thread.applicationId || selectedApplicationId
    optimisticId = `pending-${crypto.randomUUID()}`
    thread.messages.push({ id: optimisticId, role: 'user', text, createdAt: new Date().toISOString() })
    thread.messageCount = thread.messages.length
    await scrollToLatest(generation)
    if (!isCurrentAccount(generation)) return

    const payload = await apiRequest<unknown>(`/api/ai/chats/${encodeURIComponent(thread.id)}/messages`, {
      method: 'POST',
      body: {
        content: text,
        ...(applicationId ? { applicationId } : {}),
      },
    })
    if (!isCurrentAccount(generation)) return
    syncAiTokenBalance(payload)
    if (applicationId) thread.applicationId = applicationId

    const returnedThread = normalizeThread(objectFrom(payload, ['thread', 'chat']))
    if (returnedThread && returnedThread.messages.length) {
      Object.assign(thread, returnedThread)
      if (applicationId) thread.applicationId = applicationId
    } else {
      const reply = replyFrom(payload)
      if (!reply) throw new Error('Invalid AI response')
      thread.messages.push(reply)
      thread.messageCount = thread.messages.length
      thread.updatedAt = reply.createdAt
    }
    await scrollToLatest(generation)
  } catch (caught) {
    if (isCurrentAccount(generation)) {
      syncAiTokenBalance(caught)
      if (thread && optimisticId) thread.messages = thread.messages.filter((message) => message.id !== optimisticId)
      input.value = text
      error.value = userError(caught)
    }
  } finally {
    if (isCurrentAccount(generation)) responding.value = false
  }
}

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
}
</script>

<template>
  <div v-if="session" class="fixed bottom-5 right-5 z-[90] sm:bottom-7 sm:right-7">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-3 scale-95 opacity-0" leave-active-class="transition duration-150 ease-in" leave-to-class="translate-y-3 scale-95 opacity-0">
      <section v-if="open" class="mb-4 flex h-[min(650px,calc(100vh-110px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-[0_24px_70px_rgba(23,19,107,.24)]" aria-label="Minerva AI chat">
        <header class="flex items-center justify-between bg-gradient-to-r from-[#17136b] to-[#5b45f5] px-4 py-3.5 text-white">
          <div class="flex items-center gap-2.5"><span class="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Sparkles :size="18" /></span><div><h2 class="text-sm font-bold">Minerva AI</h2><p class="text-[11px] text-violet-200">Scholarship assistant</p></div></div>
          <div class="flex items-center gap-1"><button type="button" class="rounded-lg p-2 hover:bg-white/10" aria-label="Chat history" @click="showHistory = !showHistory"><History :size="18" /></button><button type="button" class="rounded-lg p-2 hover:bg-white/10" aria-label="New chat" @click="newChat"><Plus :size="18" /></button><button type="button" class="rounded-lg p-2 hover:bg-white/10" aria-label="Close chat" @click="open = false"><X :size="18" /></button></div>
        </header>

        <div v-if="error" class="flex items-start gap-2 border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          <AlertCircle class="mt-0.5 shrink-0" :size="15" /><span class="min-w-0 flex-1">{{ error }}</span><button type="button" class="font-bold underline" @click="loadThreads"><RefreshCw :size="14" aria-label="Retry" /></button>
        </div>

        <div v-if="showHistory" class="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
          <div class="mb-3 flex items-center justify-between px-1"><h3 class="text-sm font-bold text-[#17136b]">Chat history</h3><button class="text-xs font-bold text-[#5b45f5]" @click="newChat">New chat</button></div>
          <div v-if="loadingThreads" class="grid place-items-center p-10 text-[#5b45f5]"><LoaderCircle class="animate-spin" :size="24" /></div>
          <p v-else-if="!threads.length" class="rounded-xl bg-white p-5 text-center text-sm text-slate-400">No saved conversations yet.</p>
          <article v-for="thread in threads" v-else :key="thread.id" class="mb-2 flex items-center gap-2 rounded-xl border bg-white p-2" :class="thread.id === activeId && 'border-violet-300'">
            <button class="min-w-0 flex-1 px-1 py-1 text-left" @click="openThread(thread.id)"><strong class="block truncate text-sm text-[#17136b]">{{ thread.title }}</strong><span class="text-[11px] text-slate-400">{{ formatDate(thread.updatedAt || thread.createdAt) }} · {{ thread.messageCount }} messages</span></button>
            <button class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" :aria-label="`Delete ${thread.title}`" @click="deleteThread(thread.id)"><Trash2 :size="16" /></button>
          </article>
        </div>

        <template v-else>
          <div ref="messageArea" class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8f7ff] p-4">
            <div v-if="loadingThreads || loadingThread" class="grid h-full place-content-center text-[#5b45f5]"><LoaderCircle class="animate-spin" :size="27" /></div>
            <div v-else-if="!activeThread?.messages.length" class="grid h-full place-content-center px-5 text-center"><span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Bot :size="27" /></span><h3 class="mt-4 text-lg font-bold text-[#17136b]">How can I help?</h3><p class="mt-2 text-sm leading-6 text-slate-500">Ask about scholarships, deadlines, documents, interviews, or your application plan.</p></div>
            <template v-else>
              <div v-for="message in activeThread.messages" :key="message.id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'"><p class="max-w-[84%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-5" :class="message.role === 'user' ? 'rounded-br-md bg-[#5b45f5] text-white' : 'rounded-bl-md border border-violet-100 bg-white text-slate-600'">{{ message.text }}</p></div>
            </template>
            <div v-if="responding" class="flex justify-start"><span class="rounded-2xl rounded-bl-md border border-violet-100 bg-white px-4 py-2 text-sm tracking-[.25em] text-[#5b45f5]">•••</span></div>
          </div>
          <form class="flex items-end gap-2 border-t border-slate-100 bg-white p-3" @submit.prevent="send"><textarea v-model="input" rows="1" class="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#5b45f5] focus:ring-2 focus:ring-violet-100" placeholder="Ask Minerva AI…" :disabled="loadingThreads" @keydown.enter.exact.prevent="send" /><button type="submit" class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5b45f5] text-white disabled:opacity-40" :disabled="!input.trim() || responding || loadingThreads" aria-label="Send message"><LoaderCircle v-if="responding" class="animate-spin" :size="18" /><Send v-else :size="18" /></button></form>
        </template>
      </section>
    </Transition>

    <button type="button" class="ml-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#5b45f5] to-[#17136b] text-white shadow-[0_12px_30px_rgba(91,69,245,.38)] transition hover:-translate-y-1" :aria-label="open ? 'Close Minerva AI chat' : 'Chat with Minerva AI'" @click="open = !open">
      <X v-if="open" :size="23" /><MessageCircle v-else :size="24" />
    </button>
  </div>
</template>
