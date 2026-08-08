<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Bot, History, MessageCircle, Plus, Send, Sparkles, Trash2, X } from 'lucide-vue-next'

interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; createdAt: string }
interface ChatThread { id: string; title: string; createdAt: string; messages: ChatMessage[] }

const readThreads = (): ChatThread[] => {
  try { return JSON.parse(localStorage.getItem('minerva-ai-chats') || '[]') as ChatThread[] }
  catch { return [] }
}

const open = ref(false)
const showHistory = ref(false)
const input = ref('')
const responding = ref(false)
const threads = ref<ChatThread[]>(readThreads())
const activeId = ref(threads.value[0]?.id || '')
const messageArea = ref<HTMLElement | null>(null)
const activeThread = computed(() => threads.value.find((thread) => thread.id === activeId.value) || null)

watch(threads, (value) => localStorage.setItem('minerva-ai-chats', JSON.stringify(value)), { deep: true })

const scrollToLatest = async () => {
  await nextTick()
  messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight, behavior: 'smooth' })
}
const newChat = () => {
  activeId.value = ''
  showHistory.value = false
  input.value = ''
}
const openThread = (id: string) => {
  activeId.value = id
  showHistory.value = false
  scrollToLatest()
}
const deleteThread = (id: string) => {
  threads.value = threads.value.filter((thread) => thread.id !== id)
  if (activeId.value === id) activeId.value = threads.value[0]?.id || ''
}
const assistantReply = (question: string) => {
  const value = question.toLowerCase()
  if (value.includes('deadline')) return 'I can help you plan around a deadline. Open the scholarship detail page to verify its date, then add it to My Scholarships to get a dedicated checklist.'
  if (value.includes('essay') || value.includes('document')) return 'Start with the scholarship criteria, then connect each claim to one specific example and measurable result. You can use Minerva’s Document Reviewer for focused feedback.'
  if (value.includes('interview')) return 'Prepare a 60–90 second answer that covers your goal, evidence, and expected impact. The Interview Prep workspace can help you practise it aloud.'
  if (value.includes('scholarship') || value.includes('match')) return 'Tell me your target country, study level, field, and funding preference. I’ll help you narrow the strongest scholarship options.'
  return 'I’m here to help with scholarship discovery, application planning, documents, deadlines, and interview preparation. What are you working on right now?'
}
const send = async () => {
  const text = input.value.trim()
  if (!text || responding.value) return
  let thread = activeThread.value
  if (!thread) {
    thread = { id: `chat-${Date.now()}`, title: text.slice(0, 42), createdAt: new Date().toISOString(), messages: [] }
    threads.value = [thread, ...threads.value]
    activeId.value = thread.id
  }
  thread.messages.push({ id: `message-${Date.now()}`, role: 'user', text, createdAt: new Date().toISOString() })
  input.value = ''
  responding.value = true
  await scrollToLatest()
  window.setTimeout(() => {
    thread?.messages.push({ id: `message-${Date.now()}-ai`, role: 'assistant', text: assistantReply(text), createdAt: new Date().toISOString() })
    responding.value = false
    scrollToLatest()
  }, 550)
}
const formatDate = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
</script>

<template>
  <div class="fixed bottom-5 right-5 z-[90] sm:bottom-7 sm:right-7">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-3 scale-95 opacity-0" leave-active-class="transition duration-150 ease-in" leave-to-class="translate-y-3 scale-95 opacity-0">
      <section v-if="open" class="mb-4 flex h-[min(650px,calc(100vh-110px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-[0_24px_70px_rgba(23,19,107,.24)]" aria-label="Minerva AI chat">
        <header class="flex items-center justify-between bg-gradient-to-r from-[#17136b] to-[#5b45f5] px-4 py-3.5 text-white">
          <div class="flex items-center gap-2.5"><span class="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Sparkles :size="18" /></span><div><h2 class="text-sm font-bold">Minerva AI</h2><p class="text-[11px] text-violet-200">Scholarship assistant</p></div></div>
          <div class="flex items-center gap-1"><button type="button" class="rounded-lg p-2 hover:bg-white/10" aria-label="Chat history" @click="showHistory = !showHistory"><History :size="18" /></button><button type="button" class="rounded-lg p-2 hover:bg-white/10" aria-label="New chat" @click="newChat"><Plus :size="18" /></button><button type="button" class="rounded-lg p-2 hover:bg-white/10" aria-label="Close chat" @click="open = false"><X :size="18" /></button></div>
        </header>

        <div v-if="showHistory" class="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
          <div class="mb-3 flex items-center justify-between px-1"><h3 class="text-sm font-bold text-[#17136b]">Chat history</h3><button class="text-xs font-bold text-[#5b45f5]" @click="newChat">New chat</button></div>
          <p v-if="!threads.length" class="rounded-xl bg-white p-5 text-center text-sm text-slate-400">No saved conversations yet.</p>
          <article v-for="thread in threads" :key="thread.id" class="mb-2 flex items-center gap-2 rounded-xl border bg-white p-2" :class="thread.id === activeId && 'border-violet-300'">
            <button class="min-w-0 flex-1 px-1 py-1 text-left" @click="openThread(thread.id)"><strong class="block truncate text-sm text-[#17136b]">{{ thread.title }}</strong><span class="text-[11px] text-slate-400">{{ formatDate(thread.createdAt) }} · {{ thread.messages.length }} messages</span></button>
            <button class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" :aria-label="`Delete ${thread.title}`" @click="deleteThread(thread.id)"><Trash2 :size="16" /></button>
          </article>
        </div>

        <template v-else>
          <div ref="messageArea" class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8f7ff] p-4">
            <div v-if="!activeThread?.messages.length" class="grid h-full place-content-center px-5 text-center"><span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Bot :size="27" /></span><h3 class="mt-4 text-lg font-bold text-[#17136b]">How can I help?</h3><p class="mt-2 text-sm leading-6 text-slate-500">Ask about scholarships, deadlines, documents, interviews, or your application plan.</p></div>
            <div v-for="message in activeThread?.messages || []" :key="message.id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'"><p class="max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-5" :class="message.role === 'user' ? 'rounded-br-md bg-[#5b45f5] text-white' : 'rounded-bl-md border border-violet-100 bg-white text-slate-600'">{{ message.text }}</p></div>
            <div v-if="responding" class="flex justify-start"><span class="rounded-2xl rounded-bl-md border border-violet-100 bg-white px-4 py-2 text-sm tracking-[.25em] text-[#5b45f5]">•••</span></div>
          </div>
          <form class="flex items-end gap-2 border-t border-slate-100 bg-white p-3" @submit.prevent="send"><textarea v-model="input" rows="1" class="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#5b45f5] focus:ring-2 focus:ring-violet-100" placeholder="Ask Minerva AI…" @keydown.enter.exact.prevent="send" /><button type="submit" class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5b45f5] text-white disabled:opacity-40" :disabled="!input.trim() || responding" aria-label="Send message"><Send :size="18" /></button></form>
        </template>
      </section>
    </Transition>

    <button type="button" class="ml-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#5b45f5] to-[#17136b] text-white shadow-[0_12px_30px_rgba(91,69,245,.38)] transition hover:-translate-y-1" :aria-label="open ? 'Close Minerva AI chat' : 'Chat with Minerva AI'" @click="open = !open">
      <X v-if="open" :size="23" /><MessageCircle v-else :size="24" />
    </button>
  </div>
</template>
