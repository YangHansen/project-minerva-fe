<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderOpen,
  Globe2,
} from "lucide-vue-next";
import ScholarshipCard from "../components/scholarships/ScholarshipCard.vue";
import { scholarships } from "../data/scholarships";

const activeFeature = ref(0);
const activeDestination = ref("All");

const features = [
  {
    label: "Scholarship Discovery",
    image: "/feature-discovery.png",
    alt: "Chevening Scholarship discovery card",
  },
  {
    label: "AI Recommendations",
    image: "/feature-ai-recommendations.png",
    alt: "AI scholarship recommendations and Chevening match",
  },
  {
    label: "Application Preparation",
    image: "/feature-preparation.png",
    alt: "IELTS test preparation workspace",
  },
  {
    label: "Progress Tracking",
    image: "/feature-progress-tracking.png",
    alt: "Chevening Scholarship application progress tracker",
  },
];

const destinations = [
  { label: "All", flag: "🌐" },
  { label: "USA", flag: "🇺🇸" },
  { label: "Australia", flag: "🇦🇺" },
  { label: "Japan", flag: "🇯🇵" },
  { label: "China", flag: "🇨🇳" },
  { label: "South Korea", flag: "🇰🇷" },
];

const visibleScholarships = computed(() => {
  if (activeDestination.value === "All") return scholarships.slice(0, 3);
  const countryMap: Record<string, string> = {
    USA: "United States",
    Australia: "Australia",
    Japan: "Japan",
    China: "China",
    "South Korea": "South Korea",
  };
  const exact = scholarships.filter((item) =>
    item.country.includes(countryMap[activeDestination.value]),
  );
  return exact.length ? exact.slice(0, 3) : scholarships.slice(0, 3);
});
</script>

<template>
  <main class="overflow-hidden bg-white">
    <section class="px-4 pt-5 sm:px-7">
      <div
        class="relative mx-auto max-w-[1460px] overflow-hidden rounded-b-[34px] bg-[radial-gradient(circle_at_10%_100%,rgba(108,80,205,.32),transparent_43%),radial-gradient(circle_at_92%_96%,rgba(44,174,236,.56),transparent_44%),linear-gradient(180deg,#fff_0%,#fff_24%,#fbf9ff_52%,#effaff_100%)] px-5 pt-14 sm:min-h-[760px] sm:px-10 sm:pt-16"
      >
        <div class="relative z-10 mx-auto max-w-4xl text-center">
          <h1
            class="text-[2.55rem] font-black leading-[.96] tracking-[-.055em] text-[#17136b] sm:text-[3.25rem] sm:leading-[.94] lg:text-[3.65rem]"
          >
            Find scholarship.<br /><span class="text-[#5b45f5]"
              >Apply confidently.</span
            >
          </h1>
          <p
            class="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base"
          >
            Minerva helps you discover scholarships that match your profile,
            understand every requirement, strengthen your documents, and track
            your application journey—all in one place.
          </p>
          <RouterLink
            to="/register"
            class="btn-primary mt-7 mb-0 md:mb-7 !bg-[#17136b]"
          >
            Get Started Free
            <ArrowRight :size="17" />
          </RouterLink>
        </div>

        <div
          class="relative mx-auto mt-8 aspect-[1810/756] max-w-[980px] overflow-hidden rounded-t-[20px] border border-white/80 bg-white/95 shadow-[0_30px_80px_rgba(23,19,107,.18)] sm:absolute sm:inset-x-10 sm:bottom-0 sm:mt-0 sm:h-[390px] sm:aspect-auto sm:rounded-t-[28px] sm:p-2.5"
        >
          <img
            src="/landing-dashboard-reference.png"
            alt="Minerva scholarship workspace showing folders, application readiness, checklist, and documents"
            class="absolute inset-x-0 top-3 z-20 h-[calc(100%-0.75rem)] w-full object-contain object-top sm:top-4 sm:h-[calc(100%-1rem)] sm:object-cover"
          />
          <div
            class="grid h-full grid-cols-[74px_minmax(0,1fr)] overflow-hidden rounded-t-[20px] border border-slate-200 bg-[#f7f8fc] sm:grid-cols-[190px_minmax(0,1fr)]"
          >
            <aside class="border-r border-slate-200 bg-white p-3 sm:p-4">
              <img
                src="/minerva-logo.png"
                alt="Minerva"
                class="h-9 w-28 object-contain object-left sm:h-11 sm:w-36"
              />
              <p
                class="mt-7 hidden text-[.58rem] font-black uppercase tracking-[.14em] text-slate-400 sm:block"
              >
                Scholar workspace
              </p>
              <div
                class="mt-3 grid gap-1.5 text-[.68rem] font-bold text-slate-500"
              >
                <span
                  class="flex items-center gap-2 rounded-lg bg-violet-100 p-2.5 text-[#5b45f5]"
                  ><FolderOpen :size="14" />
                  <i class="hidden not-italic sm:inline"
                    >My scholarships</i
                  ></span
                >
                <span class="flex items-center gap-2 p-2.5"
                  ><Globe2 :size="14" />
                  <i class="hidden not-italic sm:inline">Discover</i></span
                >
                <span class="flex items-center gap-2 p-2.5"
                  ><FileText :size="14" />
                  <i class="hidden not-italic sm:inline">Documents</i></span
                >
              </div>
            </aside>
            <div class="min-w-0 p-4 sm:p-6">
              <div>
                <p
                  class="text-[.58rem] font-black uppercase tracking-[.14em] text-[#5b45f5]"
                >
                  Scholar workspace
                </p>
                <h2 class="mt-1 text-lg font-black text-[#17136b] sm:text-2xl">
                  My scholarships
                </h2>
              </div>
              <div class="mt-5 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
                <div
                  class="hidden rounded-2xl border border-slate-200 bg-white p-3 lg:block"
                >
                  <p class="text-xs font-black text-[#17136b]">
                    Folders
                    <span
                      class="ml-1 rounded-full bg-violet-100 px-2 py-1 text-[#5b45f5]"
                      >3</span
                    >
                  </p>
                  <div class="mt-3 rounded-xl bg-[#211875] p-3 text-white">
                    <p class="text-xs font-black">Chevening Scholarship</p>
                    <span class="mt-1 block text-[.58rem] text-violet-200"
                      >UK Government · United Kingdom</span
                    ><span class="mt-2 flex items-center gap-1 text-[.58rem]"
                      ><CalendarDays :size="11" /> 2026-11-03</span
                    >
                  </div>
                  <div class="mt-2 rounded-xl border border-slate-200 p-3">
                    <p class="text-xs font-black text-[#17136b]">
                      Erasmus Mundus
                    </p>
                    <span class="mt-1 block text-[.58rem] text-slate-400"
                      >European Commission</span
                    >
                  </div>
                </div>
                <div
                  class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p
                        class="text-[.56rem] font-black uppercase tracking-[.13em] text-[#5b45f5]"
                      >
                        Active scholarship
                      </p>
                      <h3
                        class="mt-2 text-xl font-black text-[#17136b] sm:text-2xl"
                      >
                        Chevening Scholarship
                      </h3>
                      <p class="mt-1 text-[.7rem] text-slate-400">
                        UK Government · United Kingdom
                      </p>
                    </div>
                    <span
                      class="hidden rounded-xl bg-violet-50 px-3 py-2 text-center text-[.6rem] font-bold text-[#17136b] sm:block"
                      >Deadline<br /><strong>2026-11-03</strong></span
                    >
                  </div>
                  <div class="mt-6 flex items-end justify-between">
                    <div>
                      <p
                        class="text-[.58rem] font-black uppercase tracking-[.12em] text-slate-400"
                      >
                        Application readiness
                      </p>
                      <p class="mt-2 text-sm font-black text-[#17136b]">
                        2 of 8 requirements ready
                      </p>
                    </div>
                    <strong class="text-3xl text-[#5b45f5]">25%</strong>
                  </div>
                  <div
                    class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                  >
                    <span
                      class="block h-full w-1/4 rounded-full bg-[#5b45f5]"
                    />
                  </div>
                  <div class="mt-5 grid gap-3 sm:grid-cols-2">
                    <div class="rounded-xl border border-slate-200 p-3">
                      <p
                        class="flex items-center gap-2 text-xs font-black text-[#5b45f5]"
                      >
                        <CheckCircle2 :size="14" /> Checklist
                      </p>
                      <p class="mt-2 text-[.66rem] text-slate-500">
                        2 of 8 tasks completed
                      </p>
                    </div>
                    <div class="rounded-xl border border-slate-200 p-3">
                      <p
                        class="flex items-center gap-2 text-xs font-black text-[#5b45f5]"
                      >
                        <FileText :size="14" /> Documents
                      </p>
                      <p class="mt-2 text-[.66rem] text-slate-500">
                        2 of 6 documents ready
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      aria-label="Scholarship partners"
      class="border-y border-slate-100 bg-white py-10 sm:py-12"
    >
      <div
        class="mx-auto mb-6 flex w-[min(1180px,calc(100%-40px))] items-center justify-center gap-3 text-center"
      >
        <span class="h-px w-10 bg-violet-200" />
        <p
          class="text-[.68rem] font-black uppercase tracking-[.2em] text-slate-400"
        >
          Trusted scholarship programs worldwide
        </p>
        <span class="h-px w-10 bg-violet-200" />
      </div>
      <div class="mx-auto w-[min(1320px,calc(100%-40px))]">
        <img
          src="/scholarship-partners.png"
          alt="Chevening, Manaaki New Zealand, LPDP, MEXT, Fulbright, and Australia Awards"
          class="mx-auto h-auto w-full object-contain opacity-75"
        />
      </div>
    </section>

    <section id="product" class="py-20 sm:py-28">
      <div
        class="mx-auto grid w-[min(1320px,calc(100%-40px))] items-stretch gap-14 lg:grid-cols-[.9fr_1.1fr]"
      >
        <div>
          <p
            class="text-xs font-black uppercase tracking-[.18em] text-[#5b45f5]"
          >
            One platform, complete support
          </p>
          <h2
            class="mt-5 max-w-xl text-[clamp(2.6rem,4.25vw,4rem)] font-black leading-[1.02] tracking-[-.055em] text-[#17136b]"
          >
            From scholarship search to application readiness
          </h2>
          <p class="mt-5 max-w-lg text-sm leading-7 text-slate-500">
            Minerva brings scholarships, documents, tracking, and preparation
            into one guided platform.
          </p>
          <div class="mt-8 grid max-w-lg">
            <button
              v-for="(feature, index) in features"
              :key="feature.label"
              class="border-b border-slate-200 py-4 text-left text-sm font-bold text-slate-400"
              :class="
                activeFeature === index && '!border-[#5b45f5] !text-[#17136b]'
              "
              @click="activeFeature = index"
            >
              {{ feature.label }}
            </button>
          </div>
        </div>

        <div
          class="relative grid h-full min-h-[480px] place-items-center overflow-hidden rounded-[30px] bg-gradient-to-br from-[#f2efff] to-[#edf8ff] p-2 sm:p-4 lg:min-h-[590px]"
        >
          <Transition
            mode="out-in"
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="translate-y-2 opacity-0"
            leave-active-class="transition duration-200 ease-in"
            leave-to-class="-translate-y-2 opacity-0"
          >
            <img
              :key="features[activeFeature].image"
              :src="features[activeFeature].image"
              :alt="features[activeFeature].alt"
              class="max-h-full w-full object-contain"
            />
          </Transition
          >
        </div>
      </div>
    </section>

    <section class="bg-[#fbfbfe] py-20 sm:py-28">
      <div class="mx-auto w-[min(1180px,calc(100%-40px))]">
        <div class="text-center">
          <p
            class="text-xs font-black uppercase tracking-[.18em] text-[#5b45f5]"
          >
            Featuring top destinations
          </p>
          <h2
            class="mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-black tracking-[-.05em] text-[#17136b]"
          >
            Available 200+ Scholarships Worldwide
          </h2>
        </div>
        <div class="mt-8 flex flex-wrap justify-center gap-2.5">
          <button
            v-for="destination in destinations"
            :key="destination.label"
            class="inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold"
            :class="
              activeDestination === destination.label
                ? 'border-[#17136b] bg-[#17136b] text-white'
                : 'border-slate-200 bg-white text-slate-500'
            "
            @click="activeDestination = destination.label"
          >
            <Globe2 v-if="destination.label === 'All'" :size="15" />{{
              destination.label
            }}
          </button>
        </div>
        <div class="mt-10 grid gap-5 lg:grid-cols-3">
          <ScholarshipCard
            v-for="item in visibleScholarships"
            :key="item.id"
            :scholarship="item"
            compact
          />
        </div>
        <div class="mt-10 text-center">
          <RouterLink
            to="/scholarships"
            class="btn-primary !rounded-full !bg-[#17136b] !px-8"
            >Explore More <ArrowRight :size="17"
          /></RouterLink>
        </div>
      </div>
    </section>

    <section id="faq" class="px-4 py-20 sm:px-7">
      <div
        class="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-7 rounded-[30px] bg-gradient-to-r from-[#17136b] to-[#5b45f5] px-7 py-12 text-center text-white sm:flex-row sm:text-left"
      >
        <div>
          <p
            class="text-xs font-black uppercase tracking-[.18em] text-violet-200"
          >
            Find. Prepare. Succeed.
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Your next scholarship starts here.
          </h2>
        </div>
        <RouterLink
          to="/register"
          class="btn-primary shrink-0 !bg-white !text-[#17136b]"
          >Create your profile <ArrowRight :size="17"
        /></RouterLink>
      </div>
    </section>
  </main>
</template>
