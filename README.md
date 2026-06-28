<h1 align="center">🔍 TRACER — AI-Powered Engineering Intelligence Platform</h1>

<p align="center">
  <strong>A real-time platform that tracks how software changes propagate across teams, modules, and system dependencies — turning every commit into actionable organizational intelligence.</strong>
</p>

<p align="center">
  <em>Built for the hackathon — helping engineering organizations move from reactive firefighting to proactive, AI-driven visibility.</em>
</p>

<p align="center">
  <a href="https://canva.link/5m9po3dqa6gbyis" target="_blank"><strong>📊 Slide Deck</strong></a>
  &nbsp;·&nbsp;
  <a href="https://youtu.be/3IGaLo1Fz9w" target="_blank"><strong>🎥 Pitching Video</strong></a>
</p>

---

## 📋 Project Overview

### Problem Statement

**Software Teams Work in Silos, Creating Invisible Risks**

As software systems grow, development teams become increasingly specialized. Frontend, backend, data, and DevOps teams each own their slice of the system — but they rarely have clear visibility into each other's work.

**Current Challenges:**

🔴 **Communication Gap**
Teams typically discover changes made by other teams only during stand-up meetings or after incidents occur. By the time issues are identified, valuable development time has already been lost.

🔴 **Hidden Dependencies**
A change in one service can unintentionally cascade into another team's system. Developers rarely know who else is impacted by their commit before it ships.

🔴 **Reactive Problem Solving**
Teams spend significant time investigating questions like:
- *"Who changed this?"*
- *"Which service caused this incident?"*
- *"Which team owns this dependency?"*

🔴 **Lack of System-Wide Visibility**
Existing tools (GitHub, Jira, etc.) show individual commits and tickets but fail to provide a holistic view of how teams, services, and components are interconnected over time.

---

### Proposed Solution

**TRACER** connects directly to GitHub repositories via webhooks and the GitHub API, ingests every commit in real time, and runs a **4-agent AI pipeline** powered by **Gemini 2.5 Flash on Vertex AI** to:

1. **Understand** what each change does — technically and in business terms.
2. **Analyse** which system layers (frontend, backend, database, shared services, data pipelines) are affected.
3. **Predict** the blast radius — which teams are at risk, what could fail, and what the production risk level is.
4. **Recommend** tests to run, teams to notify, rollback steps, and priority actions.

The result is a living, real-time map of engineering impact — delivered as an **Intelligence Dashboard**, a **Commit Feed with AI insights**, and a **Reports module** with cross-team matrices, hotspot analysis, dependency chains, and AI-generated executive summaries.

---

### 💡 System Features

| Feature | Explanation |
| :--- | :--- |
| **Real-Time Commit Feed** | Live Firestore listener ingests commits as they land via GitHub webhooks. Displays author, branch, SHA, timestamp, and inline classification chips. |
| **4-Agent AI Pipeline** | Sequential Gemini 2.5 Flash agents: Change Understanding → Dependency Analysis → Impact Prediction → Recommendations. Each agent feeds context into the next. |
| **Risk Classification** | Every commit is automatically scored as `LOW`, `MEDIUM`, or `CRITICAL` with a one-sentence reasoning and two plain-English summary lines. |
| **Team Impact Matrix (Commits)** | Toggle the commit list into a matrix view — rows are commits, columns are teams — with ✓ marks showing which teams are affected by each commit. |
| **Cross-Team Impact Matrix (Reports)** | A heat-map matrix showing directional change impact between engineering teams (who is causing disruptions to whom), with interactive row/column hover highlighting. |
| **Module Hotspot Analysis** | Ranks modules by commit frequency, dependency depth, and cross-team impact. Highlights the most change-prone files with proportional impact bars. |
| **Dependency Chain Visualizer** | Shows the ripple cascade order for each module — which services depend on which, and how deeply. |
| **High-Risk Changes Feed** | Expandable commit rows filtered to `CRITICAL` and `MEDIUM` risk, with AI-generated impact explanations per commit. |
| **AI Executive Summary** | Auto-generated sprint-level insights covering key findings, risk themes, and recommended actions — displayed in a 3-column card layout. |
| **Repository Management** | Connect multiple GitHub repositories, configure custom module groupings, and monitor webhook delivery health per repo. |
| **Department & Module Filtering** | Filter the commit feed by team department or module, derived dynamically from AI classification data. |

---

### SDG Alignment

* **SDG 9 — Industry, Innovation, and Infrastructure**: Drives digital transformation in software engineering by replacing manual, error-prone cross-team communication with AI-powered, real-time dependency awareness.
* **SDG 17 — Partnerships for the Goals**: Strengthens collaboration between engineering teams by making the impact of every change visible to everyone — from individual developers to engineering leaders.

---

## 📐 Technical Architecture

![Technical Architecture Diagram](Technical%20Architecture%20TRACER.png)

---

## 🛠️ Technologies Used

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router, React Server Components) |
| **Language** | TypeScript |
| **AI / LLM** | Google Gemini 2.5 Flash via Vertex AI (`@google/genai`) |
| **Database** | Firebase Firestore (real-time listener) |
| **Auth** | Firebase Authentication |
| **Backend** | Next.js API Routes (Node.js runtime) |
| **GitHub Integration** | GitHub REST API v3 + Webhook events |
| **Styling** | Vanilla CSS Modules with custom design token system |
| **Deployment** | Vercel / Node.js compatible host |

---

## 💻 Usage Instructions

### 1. Prerequisites

Ensure you have the following installed:

* **Node.js**: Version 18.0.0 or higher
* **npm**: Version 9.0.0 or higher
* A **Firebase project** with Firestore and Authentication enabled
* A **Google Cloud project** with Vertex AI API enabled
* A **GitHub App or Personal Access Token** with `repo` and `admin:repo_hook` scopes

---

### 2. Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd tracer-app
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Add Google Cloud Service Account Credentials**:

   Place your Google Cloud service account JSON file at:
   ```
   credentials/google.json
   ```
   This file must have the **Vertex AI User** role granted in your GCP project.

4. **Configure Environment Variables**:

   Create a `.env` file in the root directory:
   ```env
   # Google Cloud / Vertex AI
   GOOGLE_APPLICATION_CREDENTIALS=credentials/google.json
   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   GEMINI_MODEL=gemini-2.5-flash

   # GitHub Integration
   GITHUB_TOKEN=your_github_personal_access_token
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ```

5. **Configure Firebase Client SDK**:

   Update `src/lib/firebase.ts` with your Firebase project client configuration (API key, project ID, auth domain, etc.).

6. **Setup Demo Environment**:
   - You can clone the repository [https://github.com/yaotingchun/tracer-testing](https://github.com/yaotingchun/tracer-testing) to test the application by connecting to the cloned repository as an existing repository in the Settings page.
   - Then, you can make changes to the repository and push them to the remote repository to test the application. You will see the changes reflected in the Commits feed in real time.

---

### 3. Running Locally

#### Development Mode (with Hot Reloading)

```bash
npm run dev
```

* **Local URL**: `http://localhost:3000`
* The dev server uses **Turbopack** for fast incremental builds.
* Firestore real-time listeners connect automatically using your Firebase config.

#### Production Build

```bash
npm run build
npm start
```

---

### 4. Connecting a GitHub Repository

1. Navigate to **Settings** inside the TRACER app.
2. Enter your repository full name (e.g. `your-org/your-repo`) and GitHub token.
3. TRACER registers a webhook on the repository automatically.
4. Once connected, commits appear in the **Commits** feed in real time.
5. Click **Analyze with AI** on any commit to trigger the 4-agent pipeline.

---

### 5. Using the AI Pipeline

The AI insight pipeline runs when you click **Analyze with AI** on a commit:

| Agent | Role |
| :--- | :--- |
| **Agent 1 — Change Understanding** | Classifies the commit type, identifies the component, explains the business meaning |
| **Agent 2 — Dependency Analysis** | Maps which system layers are affected (frontend, backend, database, data pipeline, shared services) |
| **Agent 3 — Impact Prediction** | Predicts affected teams, potential failure modes, production risks, and assigns a risk level |
| **Agent 4 — Recommendations** | Generates required tests, teams to notify, rollback steps, and priority actions |

Results are written back to Firestore and immediately visible to all users via the real-time listener.

---

## 📈 Strategy & Operations

### 🎯 Target Customers
* **Enterprise Engineering Organizations (50+ Developers)**: Teams managing complex microservices, distributed architectures, or monorepos where siloed communication leads to integration risks.
* **High-Growth Startups & Scale-ups**: Companies shipping code rapidly with fast-changing team structures, requiring automated alignment and risk profiling tools.
* **DevOps & Platform Engineering Teams**: Teams focused on system stability, automated blast-radius calculations, and minimizing mean time to recovery (MTTR).
* **CTOs & Engineering Leaders**: Executives seeking metrics on cross-team dependencies, module coupling, and code risk indicators.

### 🛣️ Adoption Path
1. **Phase 1: Observation Mode (Days 1–7)**: Connect read-only repository integration. Begin populating the real-time commit feed, running AI classification, and mapping team dependency layers without modifying CI/CD workflows.
2. **Phase 2: Collaborative Insights (Days 8–14)**: Introduce the interactive dashboards and team impact matrices to team leads. Use the AI executive summary during sprint planning and retro meetings.
3. **Phase 3: Real-Time Alerts (Days 15–30)**: Set up automated Slack or Microsoft Teams notifications for medium/high-risk commits to ensure teams take immediate proactive actions.
4. **Phase 4: Workflow Guardrail (Day 30+)**: Enforce TRACER analysis as required GitHub status checks or PR merge requirements to guarantee impact reviews.

### 🗺️ Implementation Roadmap
* **Q3 2026: Prompt Optimization & Integrations**: Fine-tune the Vertex AI prompt templates for Gemini, implement Slack notification webhooks, and launch PR-level check analysis.
* **Q4 2026: Advanced Reporting & Custom Rules**: Add custom risk thresholds (e.g. key directory tracking), historical risk velocity charts, and PDF report export for engineering leadership.
* **Q1 2027: Deep Ecosystem Integrations**: Connect with issue trackers (Jira, Linear) and monitoring tools (Datadog, OpenTelemetry) to dynamically link commits to incidents.
* **Q2 2027: Enterprise Self-Hosted Deployment**: Package TRACER with Docker and Helm for private Kubernetes deployment inside virtual private clouds (VPC).

### 🛡️ Compliance & Security
* **Data Security & Privacy**: TRACER only processes commit metadata, author details, and code diffs. Source code is analyzed in-memory via the Vertex AI API and is not persisted.
* **Model Training Exemption**: All calls to Vertex AI (Gemini 2.5 Flash) utilize enterprise pipelines where user data is not retained and never used to train public models.
* **Authentication & RBAC**: Enforce repository and workspace access levels using Firebase Auth integrated with GitHub OAuth credentials.
* **Audit Trails**: Maintain immutable logs of all executed AI pipeline summaries, connect webhooks, and user actions for SOC 2 Type II audit readiness.

---

## 🌍 Social Impact

TRACER directly reduces the **human cost of poor engineering visibility**:

- **Fewer incidents from undiscovered dependencies** — teams are notified proactively before a change ships, not after it breaks production.
- **Faster incident resolution** — the dependency chain and blast radius are pre-computed, cutting mean time to recovery (MTTR).
- **Reduced cognitive overhead** — engineers don't need to manually trace which teams to notify or which tests to run; TRACER surfaces this automatically.
- **More equitable information access** — junior developers get the same organizational context that previously only existed in senior engineers' heads.
- **Healthier team dynamics** — replacing blame-driven post-mortems with pre-emptive, AI-generated impact awareness shifts culture toward collaboration.

---

## 🔮 Future Improvements

- **Slack / Teams Integration** — automatically post AI-generated risk summaries to team channels when a high-risk commit is detected.
- **PR-level Analysis** — run the 4-agent pipeline on pull requests before merge, not just after commit.
- **Historical Trend Charts** — visualize how cross-team coupling and risk levels change over sprints.
- **Custom Risk Rules** — allow teams to define their own `CRITICAL` thresholds (e.g. any change to `payments/` is auto-CRITICAL).
- **JIRA / Linear Integration** — link commits to tickets and automatically update ticket status based on deployment risk.
- **Team Ownership Map** — define which team owns which directory or module, enabling more accurate impact routing.
- **Multi-Org Support** — extend beyond a single GitHub organization to federated multi-org engineering intelligence.
- **Export & Reporting** — one-click export of the cross-team matrix and AI summary as a PDF sprint report for engineering leadership.
