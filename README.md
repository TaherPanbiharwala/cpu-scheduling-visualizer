# CPU Scheduling Visualizer — FCFS • SJF • Round Robin

An interactive **CPU Scheduling Visualizer** built with **pure HTML, CSS, and JavaScript**.  
It simulates classic CPU scheduling algorithms and shows:

- Animated **Gantt chart** on a canvas
- **Ready queue** evolution over time
- Per-process metrics (Waiting Time, Turnaround Time, Response Time)
- Global metrics (CPU Utilization, Throughput)
- Ability to **export** the schedule as a PNG or JSON trace

All logic runs completely **client-side** — no frameworks, no backend.

---

## 🚀 Features

### ✅ Supported Algorithms

- **FCFS (First Come First Served)**
- **SJF (Non-Preemptive Shortest Job First)**
- **Round Robin (RR)** with configurable time quantum

> Note: A *Priority* field is available per process and stored in state, but the current scheduling logic uses FCFS/SJF/RR only.

---

### 🧪 Simulation Controls

- **Algorithm selection**
  - `FCFS`
  - `SJF (Non-preemptive)`
  - `Round Robin`
- **Quantum (for Round Robin)**  
  Set the time slice used by RR.
- **Start time (t = ...)**  
  Allows simulations to begin at a non-zero time.

---

### 🧵 Process Management

In the **Simulation Setup** panel you can:

- Add processes with:
  - `PID` (e.g., `P1`, `P2`) — must be unique
  - `Arrival Time`
  - `Burst Time`
  - `Priority` (optional, stored and displayed in tables)
- Use:
  - **Add Process** — append a new process to the list  
  - **Load Sample** — quickly load a predefined example workload  
  - **Clear** — remove all processes from the table  
  - Per-row **Delete** button — remove a specific process

Processes are displayed in a table:

| PID | Arrival | Burst | Priority | Action |
|-----|---------|-------|----------|--------|

---

### 📊 Visualization & Statistics

On the right panel (**Timeline & Queues**):

- **Canvas-based Gantt Chart**
  - Colored bars for process execution
  - Grey segments for **CPU idle** time
  - Moving **time cursor** showing current simulated time
  - Time grid lines (each unit = 1 time unit)

- **Global Metrics**
  - **Current Time** — integer time at the cursor
  - **CPU Utilization** — `(busy time / total time) × 100%`
  - **Throughput** — `completed processes / total time`

- **Ready Queue View**
  - Chips showing which processes are ready but not currently running
  - Dynamically updated as the simulation plays

- **Per-Process Stats Table**

  For each process:

  - Arrival time
  - Burst time
  - Start time
  - Finish time
  - Waiting time
  - Turnaround time
  - Response time

---

### 🎬 Animation & Playback

Playback controls:

- **Build Schedule**  
  Computes the schedule (timeline + stats) using the selected algorithm.
- **▶ Play**  
  Starts the animation from the current cursor.
- **⏸ Pause**  
  Pauses playback.
- **⏩ Step**  
  Advances the simulation by 1 time unit.
- **⟲ Reset**  
  Resets the simulated time back to the start.
- **Speed Slider**  
  Adjusts animation speed (0.25x to 4x).

The internal animation:

- Uses `requestAnimationFrame` for smooth updates.
- Scales logical time vs. real time using `speed`.
- Updates:
  - Gantt chart
  - Time cursor
  - Current time
  - Ready queue

---

### 📤 Export Options

- **Export Screenshot**
  - Downloads the Gantt chart canvas as `cpu_schedule.png`.

- **Export Trace**
  - Downloads a **JSON trace** as `cpu_schedule_trace.json` containing:
    - Selected algorithm
    - Quantum
    - Start time
    - Process list
    - Timeline segments `{ pid, start, end }`
    - Per-process stats

This makes it useful for **reporting**, **debugging**, or **further analysis** in other tools.

---

## 🧱 Tech Stack

- **HTML5** — layout & structure
- **CSS (no frameworks)** — responsive, dark-themed UI
- **JavaScript (Vanilla)** — all logic:
  - Scheduling algorithms
  - Statistics computation
  - Canvas drawing & animation
  - Export utilities

No external libraries or frameworks are used.

---
