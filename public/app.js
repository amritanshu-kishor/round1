const boardEl = document.getElementById("board");
const setPill = document.getElementById("setPill");
const teamsClearedEl = document.getElementById("teamsCleared");
const clearedIdsEl = document.getElementById("clearedIds");
const timerEl = document.getElementById("timer");
const pauseBtn = document.getElementById("pauseBtn");
const toastEl = document.getElementById("toast");
const formEl = document.getElementById("hostForm");
const teamInput = document.getElementById("teamInput");
const passwordInput = document.getElementById("passwordInput");
const checkBtn = document.getElementById("checkBtn");

let roundEndTime = Date.now() + 12 * 60 * 1000;
let remainingSnapshot = 12 * 60 * 1000;
let roundStatus = "ACTIVE";
let currentSet = null;
let toastTimer = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function renderTokens(tokens) {
  return `<div class="tokens">${tokens
    .map((t) => {
      const blank = t === "?";
      return `<span class="token${blank ? " blank" : ""}">${blank ? "?" : t}</span>`;
    })
    .join("")}</div>`;
}

function renderShift(puzzle) {
  const letters = puzzle.letters
    .map((letter, i) => {
      const focus = i === puzzle.focus ? " focus" : "";
      return `<div class="glyph${focus}">
        <span class="glyph-letter">${letter}</span>
        <span class="glyph-mark"></span>
      </div>`;
    })
    .join("");

  const bars =
    puzzle.type === "varshift"
      ? `<div class="var-bars" aria-hidden="true">${puzzle.letters
          .map((_, i) => `<span class="bar" style="height:${6 + i * 4}px"></span>`)
          .join("")}</div>`
      : "";

  const hint = puzzle.hint
    ? `<div class="shift-hint">${puzzle.hint}</div>`
    : "";

  return `${bars}<div class="shift-row">${letters}</div>${hint}`;
}

function renderPuzzle(puzzle) {
  const body =
    puzzle.type === "shift" || puzzle.type === "varshift"
      ? renderShift(puzzle)
      : renderTokens(puzzle.tokens);

  return `<article class="card">
    <div class="card-index">Puzzle ${String(puzzle.n).padStart(2, "0")}</div>
    <h2 class="card-title">${puzzle.title}</h2>
    <div class="card-body">${body}</div>
  </article>`;
}

function applyState(state, options = {}) {
  if (!state) return;

  roundEndTime = state.roundEndTime;
  remainingSnapshot = state.remainingMs;
  roundStatus = state.roundStatus;
  const ids = state.clearedTeamIds || [];
  teamsClearedEl.textContent = ids.length ? ids.join(", ") : "0";
  clearedIdsEl.textContent =
    ids.length === 0 ? "" : ids.length === 1 ? "1 team" : `${ids.length} teams`;

  const timedOut = roundStatus === "EXPIRED" || roundStatus === "COMPLETE";
  teamInput.disabled = timedOut;
  passwordInput.disabled = timedOut;
  checkBtn.disabled = timedOut;
  pauseBtn.disabled = timedOut;
  pauseBtn.textContent = roundStatus === "PAUSED" ? "Resume" : "Pause";
  paintTimer();

  if (options.updatePuzzles === false) {
    return;
  }

  const nextSet = Number(state.currentSet);
  setPill.textContent = `SET ${String(nextSet).padStart(2, "0")}`;
  if (nextSet !== currentSet) {
    currentSet = nextSet;
    boardEl.innerHTML = (state.puzzles || []).map(renderPuzzle).join("");
  }
}

function paintTimer() {
  const left =
    roundStatus === "PAUSED" ? remainingSnapshot : roundEndTime - Date.now();

  if (roundStatus === "EXPIRED" || roundStatus === "COMPLETE" || (roundStatus === "ACTIVE" && left <= 0)) {
    timerEl.textContent = "TIME'S UP";
    timerEl.classList.add("ended");
    timerEl.classList.remove("paused");
    if (roundStatus === "ACTIVE") {
      roundStatus = "EXPIRED";
      teamInput.disabled = true;
      passwordInput.disabled = true;
      checkBtn.disabled = true;
      pauseBtn.disabled = true;
    }
    return;
  }

  timerEl.classList.remove("ended");
  timerEl.classList.toggle("paused", roundStatus === "PAUSED");
  timerEl.textContent = formatRemaining(left);
}

function showToast(message, isError) {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastEl.classList.remove("show", "hide", "error");
  toastEl.textContent = message;
  if (isError) toastEl.classList.add("error");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    toastEl.classList.add("hide");
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("hide", "error");
      toastEl.textContent = "";
    }, 320);
  }, 2600);
}

async function fetchState() {
  const res = await fetch("/api/state");
  const data = await res.json();
  applyState(data);
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (roundStatus === "EXPIRED" || roundStatus === "COMPLETE") return;

  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamId: teamInput.value,
      password: passwordInput.value,
    }),
  });
  const data = await res.json();

  if (!data.ok) {
    applyState(data.state, { updatePuzzles: false });
    showToast(data.message || "Incorrect password", true);
    passwordInput.select();
    return;
  }

  applyState(data.state);
  showToast(data.message, false);
  passwordInput.value = "";
  teamInput.value = "";
  teamInput.focus();
});

pauseBtn.addEventListener("click", async () => {
  const res = await fetch("/api/timer", { method: "POST" });
  const data = await res.json();
  applyState(data.state);
});

setInterval(paintTimer, 250);
setInterval(fetchState, 1000);
fetchState();
