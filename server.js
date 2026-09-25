import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import { puzzlesBySet, ROUND_MS, SET_COUNT } from "./puzzles.js";
import { SET_PASSWORDS, SITE_PASSWORD } from "./secrets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const validTickets = new Set();
const validAuthTokens = new Set();

app.use(express.json());

function secretsMatch(a, b) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

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

app.post("/api/login", (req, res) => {
  const password = String(req.body?.password ?? "");
  if (!secretsMatch(password, SITE_PASSWORD)) {
    return res.status(401).json({ ok: false, message: "Incorrect password" });
  }

  // Reset server game data on every authentication login
  game = createState();
  validAuthTokens.clear();

  const ticket = crypto.randomBytes(16).toString("hex");
  validTickets.add(ticket);
  res.json({ ok: true, ticket });
});

app.use((req, res, next) => {
  if (req.path === "/api/login") return next();

  if (req.path.startsWith("/api")) {
    const token = req.headers["x-auth-token"];
    if (token && validAuthTokens.has(token)) {
      return next();
    }
    return res.status(401).json({ ok: false, reason: "auth" });
  }

  if (req.path === "/" || req.path === "/index.html") {
    const ticket = String(req.query?.ticket ?? "");
    if (ticket && validTickets.has(ticket)) {
      validTickets.delete(ticket);
      const token = crypto.randomBytes(16).toString("hex");
      validAuthTokens.add(token);

      const indexPath = path.join(__dirname, "public", "index.html");
      let html = fs.readFileSync(indexPath, "utf8");
      html = html.replace(
        "</head>",
        `<script>window.AUTH_TOKEN = ${JSON.stringify(token)};</script></head>`
      );

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.type("html").send(html);
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return res.sendFile(path.join(__dirname, "public", "login.html"));
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  return next();
});

app.use(express.static(path.join(__dirname, "public")));

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
