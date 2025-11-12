// =========================================================
// ===============   CPU SCHEDULING VISUALIZER  =============
// =========================================================

// ---------- GLOBAL STATE ----------
// Holds all dynamic data of the simulation
const state = {
  procs: [],        // List of all processes entered: [{pid, arrival, burst, priority}]
  timeline: [],     // Final schedule timeline: [{pid|null, start, end}] (null = idle)
  stats: {},        // Per-process statistics: pid -> {arrival, burst, start, finish, waiting, tat, resp}
  t0: 0,            // Simulation start time (always 0 for correctness)
  tEnd: 0,          // Simulation end time
  built: false,     // Flag: has schedule been generated?
  anim: {           // Animation controller state
    playing: false, // Whether animation is currently running
    simTime: 0,     // Current simulation cursor (time)
    speed: 1,       // Playback speed multiplier
    lastTs: 0       // Last timestamp for frame calculation
  },
};

// ---------- HELPER FUNCTIONS ----------

// Shortcut for querySelector (DOM element selection)
const $ = (sel) => document.querySelector(sel);

// Generate deterministic color for each process using its PID string
function randColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++)
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

// Add a single process row to the process table
function addRow(p) {
  const tbody = $("#procTable tbody");
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${p.pid}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.priority ?? 0}</td>
    <td class="right"><button data-pid="${p.pid}" class="danger del">Delete</button></td>`;
  tbody.appendChild(tr);
}

// Refresh process table (re-render all processes)
function refreshProcTable() {
  const tbody = $("#procTable tbody");
  tbody.innerHTML = '';
  state.procs.forEach(addRow);

  // Add delete button handlers
  tbody.querySelectorAll('button.del').forEach(btn => {
    btn.onclick = () => {
      const pid = btn.getAttribute('data-pid');
      // Remove process from list and refresh table
      state.procs = state.procs.filter(p => p.pid !== pid);
      refreshProcTable();
    };
  });
}

// Pre-load a sample set of processes for quick testing
function loadSample() {
  state.procs = [
    { pid: 'P1', arrival: 0, burst: 6, priority: 2 },
    { pid: 'P2', arrival: 2, burst: 4, priority: 1 },
    { pid: 'P3', arrival: 4, burst: 5, priority: 3 },
    { pid: 'P4', arrival: 6, burst: 2, priority: 2 },
  ];
  refreshProcTable();
}

// =========================================================
// ================  SCHEDULING ALGORITHMS  =================
// =========================================================

function buildSchedule() {
  // Read user inputs
  const algo = $('#algo').value;
  const q = Math.max(1, Number($('#quantum').value || 1));    // Quantum for RR
  const startAt = Number($('#startAt').value || 0);           // Only for animation cursor
  const procs = state.procs.map(p => ({ ...p })).sort((a,b) => a.arrival - b.arrival);

  if (!procs.length) { alert('Add at least one process.'); return; }

  // For correctness in exam-style questions, schedule always starts at t = 0
  state.t0 = 0;
  state.timeline = [];
  state.stats = {};

  // Initialize statistics record for each process
  procs.forEach(p => state.stats[p.pid] = {
    pid: p.pid, arrival: p.arrival, burst: p.burst,
    start: null, finish: null, waiting: 0, tat: 0, resp: null
  });

  // Run selected scheduling algorithm starting from time 0
  if (algo === 'FCFS') buildFCFS(procs, 0);
  else if (algo === 'SJF') buildSJF(procs, 0);
  else if (algo === 'RR') buildRR(procs, 0, q);

  // Determine final end time
  const last = state.timeline.at(-1);
  state.tEnd = last ? last.end : 0;

  // Compute turnaround / waiting / response stats
  computeStatsFromTimeline();

  // Animation can start from user-chosen cursor time, but schedule is anchored at 0
  state.anim.simTime = Math.max(startAt, state.t0);
  state.anim.playing = false;
  state.built = true;

  // Draw visual output
  draw();
  paintStats();
}

// Insert idle period (no process running)
function idleGap(t, nextArrival) {
  if (nextArrival > t) return [{ pid: null, start: t, end: nextArrival }];
  return [];
}

/* ---------- FCFS (First Come First Served) ---------- */
function buildFCFS(arr, t) {
  let time = Math.max(t, arr[0]?.arrival ?? t);
  let i = 0;
  while (i < arr.length) {
    const p = arr[i];
    // If CPU is idle before next process arrives
    if (p.arrival > time) {
      state.timeline.push(...idleGap(time, p.arrival));
      time = p.arrival;
    }
    // Schedule current process
    state.timeline.push({ pid: p.pid, start: time, end: time + p.burst });
    time += p.burst;
    i++;
  }
}

/* ---------- SJF (Shortest Job First — Non-Preemptive) ---------- */
function buildSJF(arr, t) {
  let time = t;
  const ready = [];                // Ready queue
  const incoming = [...arr];       // Copy of all processes

  if (incoming.length) time = Math.max(time, incoming[0].arrival);

  while (ready.length || incoming.length) {
    // Move arrived processes into ready queue
    while (incoming.length && incoming[0].arrival <= time) ready.push(incoming.shift());

    if (!ready.length) {
      // If no process ready, skip idle time
      const nextA = incoming[0].arrival;
      state.timeline.push(...idleGap(time, nextA));
      time = nextA;
      continue;
    }

    // Select process with smallest burst time (tie-breaker: earlier arrival)
    ready.sort((a,b) => a.burst - b.burst || a.arrival - b.arrival);
    const p = ready.shift();

    // Execute process
    state.timeline.push({ pid: p.pid, start: time, end: time + p.burst });
    time += p.burst;
  }
}

/* ---------- ROUND ROBIN ---------- */
function buildRR(arr, t, q) {
  let time = t;
  const incoming = [...arr];
  const queue = [];
  const rem = Object.fromEntries(arr.map(p => [p.pid, p.burst])); // Remaining times per PID

  if (incoming.length) time = Math.max(time, incoming[0].arrival);

  // Helper to enqueue processes that have arrived
  function enqueueArrivals(upTo) {
    while (incoming.length && incoming[0].arrival <= upTo)
      queue.push(incoming.shift());
  }

  enqueueArrivals(time);

  while (queue.length || incoming.length) {
    if (!queue.length) {
      // CPU idle until next arrival
      const nextA = incoming[0].arrival;
      state.timeline.push(...idleGap(time, nextA));
      time = nextA;
      enqueueArrivals(time);
      continue;
    }

    const p = queue.shift();
    const run = Math.min(q, rem[p.pid]); // Time slice to execute
    state.timeline.push({ pid: p.pid, start: time, end: time + run });
    rem[p.pid] -= run;
    time += run;
    enqueueArrivals(time);
    if (rem[p.pid] > 0) queue.push(p);   // Re-queue if not finished
  }
}

/* ---------- STATISTICS CALCULATION ---------- */
function computeStatsFromTimeline() {
  const firstStart = {}, finish = {}, burst = {}, arrival = {};
  state.procs.forEach(p => { burst[p.pid] = p.burst; arrival[p.pid] = p.arrival; });

  // Extract first start and finish times from the built timeline
  for (const seg of state.timeline) {
    if (!seg.pid) continue;
    if (!(seg.pid in firstStart)) firstStart[seg.pid] = seg.start;
    finish[seg.pid] = seg.end;
  }

  // Compute per-process metrics
  Object.keys(state.stats).forEach(pid => {
    const st = state.stats[pid];
    st.start = firstStart[pid] ?? null;
    st.finish = finish[pid] ?? null;
    const arr = arrival[pid];
    const b = burst[pid];

    if (st.finish != null) {
      st.tat = st.finish - arr;    // Turnaround Time = Finish - Arrival
      st.waiting = st.tat - b;     // Waiting Time = TAT - Burst
    }
    if (st.start != null) st.resp = st.start - arr; // Response Time = Start - Arrival
  });

  // ------- NEW: Averages -------
  const all = Object.values(state.stats);
  const n = all.length || 1;

  // Sum over all processes (they should all be finished after schedule build)
  const sumTat = all.reduce((s, p) => s + (Number.isFinite(p.tat) ? p.tat : 0), 0);
  const sumWait = all.reduce((s, p) => s + (Number.isFinite(p.waiting) ? p.waiting : 0), 0);

  const avgTat = sumTat / n;
  const avgWait = sumWait / n;

  // Display averages
  $('#avgTAT').textContent = avgTat.toFixed(2);
  $('#avgWT').textContent  = avgWait.toFixed(2);

  // Keep throughput (jobs per unit time)
  const totalSpan = (state.tEnd - state.t0) || 1;
  $('#throughput').textContent = (n / totalSpan).toFixed(3) + ' jobs/unit time';

  // Removed: CPU Utilization calculation and DOM update
}

// =========================================================
// ================   DRAWING & ANIMATION   =================
// =========================================================

// Canvas setup
const canvas = $('#gantt');
const ctx = canvas.getContext('2d');

// Draw grid lines for Gantt chart
function drawGrid(x0, x1, y0, y1, step) {
  ctx.save();
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid');
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    const px = toX(x);
    ctx.moveTo(px + .5, y0);
    ctx.lineTo(px + .5, y1);
  }
  ctx.stroke();
  ctx.restore();
}

// Convert simulation time → canvas X coordinate
function toX(t) {
  const pad = 40;
  const span = Math.max(1, state.tEnd - state.t0);
  const w = canvas.width - pad * 2;
  return pad + ((t - state.t0) / span) * w;
}

// Render Gantt chart and labels
function draw() {
  const cssW = canvas.clientWidth;
  if (canvas.width !== cssW) canvas.width = cssW;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = '#0b1320';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Time grid lines
  drawGrid(0, state.tEnd - state.t0, 0, canvas.height, 1);

  const top = 40, h = 80;
  let y = top; // <-- THIS WAS MISSING EARLIER: defines vertical position of the bar

  // Draw all timeline segments
  for (const seg of state.timeline) {
    const s = Math.max(seg.start, state.t0);
    const e = Math.min(seg.end, Math.max(state.anim.simTime, state.t0));
    if (e <= s) continue;

    const x1 = toX(s), x2 = toX(e);
    ctx.fillStyle = seg.pid ? randColor(seg.pid) : '#3b4254'; // Process or idle color
    ctx.fillRect(x1, y, Math.max(1, x2 - x1), h);

    // Label each segment with PID or IDLE
    if (seg.pid) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(x1, y, Math.max(1, x2 - x1), 24);
      ctx.fillStyle = 'white';
      ctx.font = '12px ui-sans-serif';
      ctx.fillText(seg.pid, x1 + 6, y + 16);
    } else {
      ctx.fillStyle = '#c9d1e8';
      ctx.font = '12px ui-sans-serif';
      ctx.fillText('IDLE', x1 + 6, y + 16);
    }
  }

  // Time cursor line (yellow)
  const curX = toX(Math.max(state.t0, state.anim.simTime));
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(curX + .5, 20);
  ctx.lineTo(curX + .5, canvas.height - 10);
  ctx.stroke();

  // Update labels under chart
  const axis = $('#axis');
  axis.textContent = `t: ${state.t0} … ${state.tEnd} | cursor = ${state.anim.simTime.toFixed(2)}`;
  $('#curTime').textContent = Math.floor(state.anim.simTime);
}

// ---------- Animation Loop ----------
// Continuously updates simulation playback using requestAnimationFrame
function tick(ts) {
  if (!state.anim.playing) return;
  if (!state.anim.lastTs) state.anim.lastTs = ts;

  const dt = (ts - state.anim.lastTs) / 1000;    // Delta time in seconds
  state.anim.lastTs = ts;
  const inc = dt * state.anim.speed * 4;         // Scaled time progression
  state.anim.simTime = Math.min(state.tEnd, state.anim.simTime + inc);

  updateReadyQueue();
  draw();

  // Stop when simulation reaches end
  if (state.anim.simTime >= state.tEnd) state.anim.playing = false;
  else requestAnimationFrame(tick);
}

// Update "Ready Queue" chips in real-time
function updateReadyQueue() {
  const rq = $('#readyQueue'); rq.innerHTML = '';
  const t = state.anim.simTime + 1e-6;

  // Determine which process is currently running
  const running = state.timeline.find(seg => seg.pid && seg.start <= t && t < seg.end)?.pid || null;

  const completed = new Set();
  for (const seg of state.timeline)
    if (seg.pid && seg.end <= t) completed.add(seg.pid);

  // Add all processes that have arrived but not yet finished or running
  for (const p of state.procs) {
    if (p.arrival <= t && !completed.has(p.pid) && p.pid !== running) {
      const div = document.createElement('div');
      div.className = 'chip';
      div.textContent = p.pid;
      rq.appendChild(div);
    }
  }
}

// ---------- Stats Table Renderer ----------
function paintStats() {
  const tb = $('#statsTable tbody'); tb.innerHTML = '';
  for (const pid of Object.keys(state.stats)) {
    const s = state.stats[pid];
    const tr = document.createElement('tr');
    const cells = [s.pid, s.arrival, s.burst, fmt(s.start), fmt(s.finish),
                   fmt(s.waiting), fmt(s.tat), fmt(s.resp)];
    tr.innerHTML = cells.map(c => `<td>${c}</td>`).join('');
    tb.appendChild(tr);
  }

  // Helper to format missing or NaN values
  function fmt(x){ return (x==null || Number.isNaN(x)) ? '–' : Number(x).toFixed(0); }
}

// =========================================================
// ================  EXPORT / DOWNLOADS  ====================
// =========================================================

// Export Gantt chart as PNG image
function exportPNG() {
  const link = document.createElement('a');
  link.download = 'cpu_schedule.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Export full schedule trace as JSON file
function exportTrace() {
  const blob = new Blob([JSON.stringify({
    algorithm: $('#algo').value,
    quantum: Number($('#quantum').value || 0),
    startAt: Number($('#startAt').value || 0),
    processes: state.procs,
    timeline: state.timeline,
    stats: state.stats,
  }, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cpu_schedule_trace.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =========================================================
// ================  EVENT LISTENERS / UI  ==================
// =========================================================

// Add new process
$('#addProc').onclick = () => {
  const p = {
    pid: ($('#pid').value || `P${state.procs.length + 1}`).toString(),
    arrival: Number($('#arrival').value || 0),
    burst: Math.max(1, Number($('#burst').value || 1)),
    priority: Number($('#priority').value || 0),
  };
  // Ensure unique PID
  if (state.procs.find(q => q.pid === p.pid)) { alert('PID must be unique.'); return; }

  state.procs.push(p);
  refreshProcTable();
  $('#pid').value = `P${state.procs.length + 1}`;
};

// Button bindings
$('#sample').onclick = loadSample;
$('#clearList').onclick = () => { state.procs = []; refreshProcTable(); };
$('#build').onclick = () => { buildSchedule(); updateReadyQueue(); };
$('#play').onclick = () => {
  if (!state.built) buildSchedule();
  state.anim.playing = true;
  state.anim.lastTs = 0;
  requestAnimationFrame(tick);
};
$('#pause').onclick = () => { state.anim.playing = false; };
$('#step').onclick = () => {
  if (!state.built) buildSchedule();
  state.anim.simTime = Math.min(state.tEnd, state.anim.simTime + 1);
  updateReadyQueue(); draw();
};
$('#reset').onclick = () => {
  state.anim.playing = false;
  state.anim.simTime = state.t0;
  updateReadyQueue(); draw();
};
$('#speed').oninput = (e) => { state.anim.speed = Number(e.target.value); };
$('#exportPng').onclick = exportPNG;
$('#exportTrace').onclick = exportTrace;

// ---------- INITIALIZATION ----------
// Load default sample and build initial schedule
loadSample();
refreshProcTable();
buildSchedule();
draw();
updateReadyQueue();