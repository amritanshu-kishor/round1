import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { puzzlesBySet, ROUND_MS, SET_COUNT } from "./puzzles.js";
import { SET_PASSWORDS, SITE_PASSWORD } from "./secrets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const GATE_COOKIE = "r1g";
const GATE_SECRET = "round1-host-gate";
const GATE_TOKEN = crypto
  .createHmac("sha256", GATE_SECRET)
  .update("granted")
  .digest("hex");

app.use(express.json());

function parseCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function secretsMatch(a, b) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function isAuthed(req) {
  const got = parseCookie(req, GATE_COOKIE);
  if (!got || got.length !== GATE_TOKEN.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(GATE_TOKEN));
  } catch {
    return false;
  }
}

app.post("/api/login", (req, res) => {
  const password = String(req.body?.password ?? "");
  if (!secretsMatch(password, SITE_PASSWORD)) {
    return res.status(401).json({ ok: false, message: "Incorrect password" });
  }
  res.setHeader(
    "Set-Cookie",
    `${GATE_COOKIE}=${GATE_TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${12 * 60 * 60}`
  );
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (req.path === "/api/login") return next();
  if (isAuthed(req)) return next();
  if (req.path.startsWith("/api")) {
    return res.status(401).json({ ok: false, reason: "auth" });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.use(express.static(path.join(__dirname, "public")));

function createState() {
  const roundStartTime = Date.now();
  return {
    currentSet: 1,
    roundStatus: "ACTIVE",
    roundStartTime,
    durationMs: ROUND_MS,
    roundEndTime: roundStartTime + ROUND_MS,
    remainingOnPause: null,
    clearedTeamIds: [],
  };
}

let game = createState();

function remainingMs() {
  if (game.roundStatus === "PAUSED") {
    return Math.max(0, game.remainingOnPause ?? 0);
  }
  return Math.max(0, game.roundEndTime - Date.now());
}

function expireIfNeeded() {
  if (game.roundStatus === "ACTIVE" && remainingMs() <= 0) {
    game.roundStatus = "EXPIRED";
  }
}

function publicState() {
  expireIfNeeded();
  const puzzles = puzzlesBySet[game.currentSet] ?? [];
  const clearedTeamIds = [...game.clearedTeamIds];
  return {
    currentSet: game.currentSet,
    roundStatus: game.roundStatus,
    roundStartTime: game.roundStartTime,
    roundEndTime: game.roundEndTime,
    remainingMs: remainingMs(),
    durationMs: game.durationMs,
    teamsCleared: clearedTeamIds.length,
    clearedTeamIds,
    setCount: SET_COUNT,
    puzzles,
  };
}

app.get("/api/state", (_req, res) => {
  res.json(publicState());
});

app.post("/api/submit", (req, res) => {
  expireIfNeeded();

  if (game.roundStatus === "EXPIRED" || game.roundStatus === "COMPLETE") {
    return res.json({
      ok: false,
      reason: "closed",
      message: "Time's up",
      setChanged: false,
      state: publicState(),
    });
  }

  const teamRaw = req.body?.teamId;
  const teamId = Number.parseInt(String(teamRaw ?? "").trim(), 10);
  if (!Number.isInteger(teamId) || teamId < 1 || teamId > 99) {
    return res.json({
      ok: false,
      reason: "team",
      message: "Enter a team number",
      setChanged: false,
      state: publicState(),
    });
  }

  if (game.clearedTeamIds.includes(teamId)) {
    return res.json({
      ok: false,
      reason: "already",
      message: `Team ${teamId} already cleared`,
      setChanged: false,
      state: publicState(),
    });
  }

  const password = String(req.body?.password ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const setBefore = game.currentSet;
  const expected = String(SET_PASSWORDS[setBefore] ?? "").toUpperCase();
  const correct = Boolean(expected) && password === expected;

  if (!correct) {
    game.currentSet = setBefore;
    return res.json({
      ok: false,
      reason: "password",
      message: "Incorrect password",
      setChanged: false,
      state: publicState(),
    });
  }

  game.clearedTeamIds.push(teamId);

  if (game.currentSet < SET_COUNT) {
    game.currentSet += 1;
  }

  const ids = game.clearedTeamIds;
  const countLabel =
    ids.length === 1
      ? "1 team cleared"
      : `${ids.length} teams cleared (${ids.join(", ")})`;

  return res.json({
    ok: true,
    message: `✓ Team ${teamId} cleared • ${countLabel}`,
    setChanged: game.currentSet !== setBefore,
    state: publicState(),
  });
});

app.post("/api/timer", (_req, res) => {
  expireIfNeeded();

  if (game.roundStatus === "EXPIRED" || game.roundStatus === "COMPLETE") {
    return res.json({ ok: false, state: publicState() });
  }

  if (game.roundStatus === "PAUSED") {
    game.roundEndTime = Date.now() + Math.max(0, game.remainingOnPause ?? 0);
    game.remainingOnPause = null;
    game.roundStatus = "ACTIVE";
  } else {
    game.remainingOnPause = remainingMs();
    game.roundStatus = "PAUSED";
  }

  res.json({ ok: true, state: publicState() });
});

app.post("/api/clock", (req, res) => {
  const minutes = Number(req.body?.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
    return res.json({
      ok: false,
      message: "Enter minutes from 1 to 180",
      state: publicState(),
    });
  }

  const ms = Math.round(minutes * 60 * 1000);
  game.durationMs = ms;
  game.roundStartTime = Date.now();
  game.roundEndTime = game.roundStartTime + ms;

  if (game.roundStatus === "PAUSED") {
    game.remainingOnPause = ms;
  } else {
    game.remainingOnPause = null;
    game.roundStatus = "ACTIVE";
  }

  res.json({ ok: true, state: publicState() });
});

app.post("/api/set", (req, res) => {
  const next = Number.parseInt(String(req.body?.set ?? ""), 10);
  if (!Number.isInteger(next) || next < 1 || next > SET_COUNT) {
    return res.json({
      ok: false,
      message: `Choose a set from 1 to ${SET_COUNT}`,
      setChanged: false,
      state: publicState(),
    });
  }

  const setBefore = game.currentSet;
  game.currentSet = next;
  res.json({
    ok: true,
    setChanged: next !== setBefore,
    state: publicState(),
  });
});

app.post("/api/complete", (_req, res) => {
  expireIfNeeded();
  if (game.roundStatus === "ACTIVE" || game.roundStatus === "PAUSED") {
    game.roundStatus = "COMPLETE";
  }
  res.json({ ok: true, state: publicState() });
});

app.listen(PORT, () => {
  console.log(`Round 1 board at http://localhost:${PORT}`);
});
