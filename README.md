# Postrack

Post-production schedule planner for video and advertising projects.

**Live:** https://postrack.netlify.app

## What it does

Postrack helps post-production teams plan and visualize editorial schedules. Build a timeline with phases, drag them around, squish to a delivery date, generate schedules with AI, and export directly to Asana.

## How to use

### 1. Set up your project

- Click the project title to rename it
- Set your **kick-off date** and **delivery date** (the delivery date compresses the timeline to fit)
- Toggle **Business/Calendar** day mode (business mode skips weekends)

### 2. Configure deliverables

- Set the number of **CTV/Broadcast**, **Social Cuts**, and **Cutdowns**
- Adjust **team size** (editors) — more editors = shorter editorial time
- Check **Separate review streams** if CTV and Social need independent review cycles
- Toggle finishing options: **Color Grade**, **Audio Mix**, **Resizes**

### 3. Work with the timeline

- **Drag horizontally** on Gantt bars to move phases in time
- **Drag the right edge** to resize duration
- **Drag vertically** to reorder phases (works in both the phase list and Gantt)
- **Double-click** a bar to reset it to its default position
- Use the **+/- buttons** in the phase list to adjust durations
- Click phase names to rename them
- Use the type dropdown to change phase types (Internal/Client/Milestone)

### 4. AI Schedule Generation

Click **AI Generate** to have Claude build a schedule from a description:

1. Enter the **team passphrase**
2. Describe your project (e.g., "Nike brand campaign, 2 CTV spots, 15 social cuts, 3 cutdowns, deliver by June 20, 2 editors, need color grade and audio mix")
3. Click **Generate Schedule** — AI fills in the full timeline with realistic durations

The AI uses diminishing returns for large deliverable counts and recommends team sizes based on workload.

### 5. Export to Asana

Click **Asana** to push your schedule into an Asana project:

1. Enter the **team passphrase**
2. Search for an Asana project by name
3. Click **Export to Asana** — creates a section with all phases as tasks (with start and due dates)

### 6. Save & Load

Click **Save / Load** to generate a shareable code:

- **Generate Code** creates a base64 string with your full schedule — copy and share it
- **Load** restores a schedule from a pasted code

### 7. Other actions

- **Export** copies a formatted text summary to your clipboard
- **Clear** resets everything to defaults

## Team passphrase

AI Generate and Asana export require a team passphrase. This is a shared code that protects API usage. Ask your team lead for the code.

## Local development

```bash
cd postrack-app
npm install

# Basic dev (no AI/Asana):
npm run dev

# Full dev with AI + Asana functions:
npm run dev:ai
# Opens at http://localhost:8888
```

For AI and Asana to work locally, create a `.env` file in `postrack-app/`:

```
ANTHROPIC_API_KEY=your-key
TEAM_PASSPHRASE=your-passphrase
ASANA_PAT=your-asana-personal-access-token
```

## Tech stack

- React + Vite + Tailwind CSS (frontend)
- Netlify Functions (serverless backend)
- Claude API (AI schedule generation)
- Asana API (task export)
