<div  align="center">

# Minerva Frontend Client

**A one-stop solution AI powered platform that helps scholarship seekers from recommendations to preparing application requirements, all in one application.**

<p>

<img  src="https://img.shields.io/badge/Vue.js-3.5-4FC08D?style=flat-square&logo=vuedotjs"  alt="Vue.js"  /> <img  src="https://img.shields.io/badge/Vite-8.1-646CFF?style=flat-square&logo=vite"  alt="Vite"  /> <img  src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript"  alt="TypeScript"  /> <img  src="https://img.shields.io/badge/Tailwind_CSS-4.1-06B6D4?style=flat-square&logo=tailwindcss"  alt="Tailwind CSS"  /> <img  src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"  alt="License"  />

</p>

[Overview](#overview) &nbsp;&bull;&nbsp; [Features](#key-features) &nbsp;&bull;&nbsp; [Demo](#live-demo) &nbsp;&bull;&nbsp; [Installation](#installation) &nbsp;&bull;&nbsp; [API Docs](#api-documentation)

</div>

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/list.svg"  width="24"  height="24"  align="center"/> Table of Contents

- [Overview](#overview)

- [The Problem](#the-problem)

- [Our Solution](#our-solution)

- [Key Features](#key-features)

- [Live Demo](#live-demo)

- [Tech Stack](#tech-stack)

- [Architecture](#architecture)

- [Installation](#installation)

- [API Documentation](#api-documentation)

- [Deployment](#deployment)

- [Team](#team)

- [Acknowledgments](#acknowledgments)

- [Contact & Support](#contact--support)

- [Project Status](#project-status)

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/info.svg"  width="24"  height="24"  align="center"/> Overview

Minerva is a comprehensive Single Page Application (SPA) designed to assist students in discovering, tracking, and successfully applying for global scholarships. Acting as the face of the Minerva ecosystem, this frontend provides an intuitive, highly interactive interface for managing complex application requirements, preparing for interviews, reviewing documents, and connecting with mentors.

<hr/>

## <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXRyaWFuZ2xlLWFsZXJ0LWljb24gbHVjaWRlLXRyaWFuZ2xlLWFsZXJ0Ij48cGF0aCBkPSJtMjEuNzMgMTgtOC0xNGEyIDIgMCAwIDAtMy40OCAwbC04IDE0QTIgMiAwIDAgMCA0IDIxaDE2YTIgMiAwIDAgMCAxLjczLTMiLz48cGF0aCBkPSJNMTIgOXY0Ii8+PHBhdGggZD0iTTEyIDE3aC4wMSIvPjwvc3ZnPg==" width="24" height="24" align="top" /> The Problem

Students often use multiple websites and services to search for scholarships, review application documents, prepare for language tests, and find mentors. This creates several problems:

- Scholarship information is scattered across different platforms.
- Students don’t know which scholarships match their profiles.
- Scholarship requirements may be difficult to understand.
- Documents may not meet scholarship standards.
- Scholarship time-window may be difficult to track.
- Students have limited access to interview and test preparation.

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/lightbulb.svg"  width="24"  height="24"  align="center"/> Our Solution

Minerva replaces the chaos of scattered spreadsheets and folders with one connected workspace. We designed the frontend to seamlessly bridge the gap between tracking requirements and actually writing the applications. A user can discover a scholarship (`/scholarships`), see exactly what is needed on their dashboard (`/dashboard` and `/checklist`), and jump straight into drafting their essays with AI assistance (`/documents/:documentId`). As documents are updated, the checklist stays perfectly in sync.

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/star.svg"  width="24"  height="24"  align="center"/> Key Features

Based on the implemented views and core components, the frontend offers the following capabilities:

### Discovery & Planning

- **Scholarship Explorer**: Browse, filter, and view detailed information for scholarships globally (`/scholarships`, `/scholarships/:id`).

- **Wishlist Tracking**: Save prospective opportunities and compare options (`/wishlist`).

- **Dynamic Checklists**: Track application milestones and specific requirements seamlessly (`/checklist`).

### Preparation & Review

- **Document Management & AI Editor**: Create, upload, and refine application essays and letters of recommendation. Features a dedicated rich-text document editor (`/documents`, `/documents/:documentId`).

- **Test Preparation**: Integrated modules for practicing standardized tests (e.g., IELTS) with targeted exercises (`/test-prep`).

- **Interview Readiness**: Dedicated workspaces to simulate and prepare for application interviews (`/interview-prep`).

### Mentorship & Economics

- **Mentor Directory**: Find and connect with experienced mentors for personalized guidance (`/mentors`).

- **Token System & Payment**: Built-in wallet mechanism to manage platform tokens for booking mentors or unlocking premium reviews (`/payment`).

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/monitor.svg"  width="24"  height="24"  align="center"/> Live Demo

### 🔗 Access Minerva

- **Production URL**: [https://app.minerva.ac.id/](https://app.minerva.ac.id/)

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/layers.svg"  width="24"  height="24"  align="center"/> Tech Stack

The application is built on a modern, high-performance web stack:

### Core Framework

- **Framework**: Vue.js 3.5 (Composition API)

- **Routing**: Vue Router 4

- **State Management**: Pinia

- **Build Tool**: Vite 8

### Styling & UI

- **CSS Framework**: Tailwind CSS v4

- **Icons**: Lucide Vue Next

- **Animations**: GSAP (GreenSock Animation Platform)

- **Typography**: Fontsource (Nunito & Nunito Sans)

### Data & API

- **API Client**: Elysia Eden (`@elysia/eden`) for end-to-end type safety

- **Validation**: TypeScript strict mode

### Utilities

- **Document Processing**: docx, jspdf

- **Product Tours**: driver.js

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/share-2.svg"  width="24"  height="24"  align="center"/> Architecture

The diagram below outlines the Vue router flow, primary user journeys, and component hierarchy:

```mermaid

flowchart TD

%% Define User Entry

User((User))



%% Public Routes

subgraph Public [Public & Auth Routes]

Landing[Landing /]

Login[Login /login]

Register[Register /register]

Forgot[Forgot Password /forgot-password]

Onboarding[Onboarding /onboarding]

end



%% Authenticated Workspace

subgraph Workspace [Authenticated Workspace]

Dashboard[Dashboard /dashboard]

Scholarships[Scholarships /scholarships]

Checklist[Checklist /checklist]

Documents[Documents /documents]

DocEditor[Document Editor /documents/:id]

TestPrep[Test Prep /test-prep]

InterviewPrep[Interview Prep /interview-prep]

Mentors[Mentors /mentors]

Wishlist[Wishlist /wishlist]

Payment[Payment & Tokens /payment]

end



%% Admin Routes

subgraph Admin [Admin Routes]

AdminScholars[Admin Scholarships /admin/scholarships]

end



%% Navigation Links

User --> Landing

User --> Login

User --> Register

Login --> Dashboard

Register --> Onboarding

Onboarding --> Dashboard



Dashboard --> Checklist

Dashboard --> Documents

Documents --> DocEditor

Dashboard --> Scholarships

Dashboard --> Wishlist

Dashboard --> TestPrep

Dashboard --> InterviewPrep

Dashboard --> Mentors

Dashboard --> Payment

Login -.->|Admin Role| AdminScholars

```

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/terminal.svg"  width="24"  height="24"  align="center"/> Installation

Follow these steps to set up the development environment locally:

1.  **Clone the repository:**

```bash

git clone https://github.com/YangHansen/project-minerva-fe.git

cd project-minerva-fe

```

2.  **Configure Environment Variables:**

Copy the example environment file and configure it. Ensure `VITE_API_URL` points to your backend instance.

```bash

cp .env.example .env

```

3.  **Install Dependencies:**

The project utilizes Bun as its package manager.

```bash

bun install

```

4.  **Start the Development Server:**

```bash

bun run dev

```

The application will be available at `http://localhost:5173`.

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/server.svg"  width="24"  height="24"  align="center"/> API Documentation

The frontend utilizes `@elysia/eden` to consume backend types and endpoints, guaranteeing end-to-end type safety between the server and the Vue client.

Rather than relying on loosely typed `fetch` wrappers, the `src/api.ts` module exports a strongly typed `apiRequest` function and a legacy Eden `treaty` client:

- **Type Safety**: Backend Elysia instances automatically export their OpenAPI/TypeBox schemas. The Eden client consumes these, meaning breaking changes in backend models immediately trigger TypeScript errors in the frontend during development or build (`vue-tsc -b`).

- **Error Handling**: Network failures and API rejections are normalized into a consistent `ApiError` class, simplifying UI state management (loading vs. error states).

- **Authentication**: The router hooks into a global authentication check (`ensureAuthenticated()`) which transparently calls `/api/auth/me` to hydrate the user session and Pinia state before navigating to protected `/workspace` routes.

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cloud.svg" width="24" height="24" align="top" /> Deployment

The frontend application and global infrastructure are managed through **Cloudflare**.

- **Hosting & CI/CD:** The Vue/Vite client is deployed via Cloudflare Pages, which automatically builds and serves the static assets on every push to the main branch.
- **Infrastructure:** Cloudflare is also utilized for all DNS management and custom domain routing, ensuring fast, global content delivery for the frontend.

_(Note: The companion backend API is containerized using Docker to run the Bun environment and is hosted independently on Render.)_

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/users.svg"  width="24"  height="24"  align="center"/> Team

**Minerva** is developed by **HERMES Team** as part of our capstone project.

<table>
  <tr>
    <td align="center">
      <img src="https://img.shields.io/badge/Fullstack-Developer-blue?style=flat-square" alt="Role"/><br/>
      <b>Bridget Beatrix Claire</b><br/>
      <a href="https://linkedin.com/in/bridget-claire">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin" alt="LinkedIn"/>
      </a><br/>
    </td>
    <td align="center">
      <img src="https://img.shields.io/badge/Project Manager-QA-purple?style=flat-square" alt="Role"/><br/>
      <b>Hansen</b><br/>
      <a href="https://linkedin.com/in/Hansen">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin" alt="LinkedIn"/>
      </a><br/>
    </td>
    <td align="center">
      <img src="https://img.shields.io/badge/QA Lead & Testing-Backend-green?style=flat-square" alt="Role"/><br/>
      <b>Mutya Qurratu'ayuni Mustafa</b><br/>
      <a href="https://linkedin.com/in/Mutya-Qurratuayuni-Mustafa">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin" alt="LinkedIn"/>
      </a><br/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="https://img.shields.io/badge/Tech Lead-QA-orange?style=flat-square" alt="Role"/><br/>
      <b>Syafira Al Atika</b><br/>
      <a href="https://linkedin.com/in/Syafira-Al-Atika">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin" alt="LinkedIn"/>
      </a><br/>
    </td>
    <td align="center">
      <img src="https://img.shields.io/badge/Data Analyst-Documentation%20%26%20DevOps-red?style=flat-square" alt="Role"/><br/>
      <b>Tsabitah Dinniyah</b><br/>
      <a href="https://linkedin.com/in/tsabitahdinniyah">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin" alt="LinkedIn"/>
      </a><br/>
    </td>
    </td>
    <td align="center">
            <img src="https://img.shields.io/badge/Fullstack-Developer-blue?style=flat-square" alt="Role"/><br/>
      <b>Yusril Zubaydi</b><br/>
      <a href="https://linkedin.com/in/yusril-zubaydi">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin" alt="LinkedIn"/>
      </a><br/>
    </td>
  </tr>
</table>

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/award.svg"  width="24"  height="24"  align="center"/> Acknowledgments

- **Sustainable Development Goals (SDG 4)** for inspiring our mission
- **OpenAI** for embedding models
- **MongoDB Atlas** for database hosting
- **All open-source contributors** whose libraries made this possible

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/mail.svg"  width="24"  height="24"  align="center"/> Contact & Support

**Email**: minerva.ai@keemail.me

<hr/>

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/activity.svg"  width="24"  height="24"  align="center"/> Project Status

**Current Version**: 1.0.0 (MVP Ready)

**Roadmap**:

- [x] **Phase 1: Core Architecture & Data** (Authentication, Normalized Scholarship Database)
- [x] **Phase 2: Intelligent Discovery** (AI Recommendations, Search & Filtering)
- [x] **Phase 3: Unified Workspace** (Checklist Tracker & Document Management Bridge)
- [x] **Phase 4: Preparation & Mentorship** (AI CV/Essay Reviews, IELTS Simulations, Mentor Booking)
- [x] **Phase 5: MVP Deployment** (Cloudflare & Render Infrastructure)
- [ ] **Phase 6: Advanced Ecosystem** (Real Payment Processing, Direct University Portal Integrations)
- [ ] **Phase 7: Global Scaling** (Advanced AI Model Training, Full Multilingual Support)
