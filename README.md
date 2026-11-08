# AI Villa HQ

A 3D office where AI agents live. Each agent sits at a desk, and you can see at a glance which ones are working, which are idle, and what they are doing right now.

The point is not the visuals — it is that orchestration becomes observable. When eight agents run in parallel, reading eight log streams is impossible. Watching eight characters at eight desks is not.

---

## The idea

Most agent frameworks present themselves as a dashboard: a table of task statuses. That works until you are running more than about five agents, at which point the table stops telling you anything you can act on.

This replaces the table with a room. Agents walk to their desk when given work, sit and type while a task is running, and get up to do something else when it is done. You look at the room and immediately know who is overloaded and who is idle — the same information, in a form you can parse without reading.

## What is in it

**Multi-agent workflows with a kanban chain.**
Agents hand work to each other through a shared board rather than direct calls: research produces a brief, campaign consumes it, campaign hands assets to ads and social. A crashed consumer is reclaimed by its provider instead of stalling the chain.

**Runtime sync.**
Agents run on top of Hermes Agent instances. The HQ mirrors each agent's state, so the room reflects what the runtime is actually doing, not what a config file claims.

**Two-way reminders.**
An agent can schedule a reminder, and you can answer it from the room. The reply routes back into that agent's context, so a scheduled prompt becomes a conversation instead of a notification.

**Browser extension layer.**
A companion extension lets an agent operate social platforms from a real logged-in browser session rather than fighting authentication from a headless script.

## Eleven default specialists

Research, social media, KOL, campaign, ads, SEO, website/UI, marketplace, design, content creation, and video editing — each a separate agent with its own SOUL/TOOLS/USER/AGENTS definition. New specialists can be created from the 3D Character menu without touching code.

## Layout

```
src/components/          3D scene, characters, furniture, camera
src/utils/               animation, state mapping, sprite helpers
server/                  Express API, agent orchestration, runtime bridge
server/services/         task queue, kanban chain, reminder scheduler
chrome-extension-medsos/ in-browser operator for social platforms
hermes_workspace/        per-agent SOUL.md / TOOLS.md / AGENTS.md (generated)
```

## Running it

```bash
npm install
npm run dev
```

Launcher `start-hq.bat` starts the backend on `127.0.0.1:3001` and the UI on `localhost:5173`, then opens the browser. Requires Node 18+.

Agent features need a Hermes Agent instance and an OpenAI-compatible provider endpoint configured in Settings. Without a key the app still runs in local simulation mode, so the 3D layer is usable on its own.

Credentials stay on your machine in `data/config.secret.json`, which is gitignored.

## Status

Personal infrastructure, running daily. The 3D layer is Three.js with hand-made voxel characters — no external asset pack, so it is easy to restyle but not photorealistic. Orchestration is coupled to Hermes; swapping in another runtime means replacing `server/services/`.

## License

MIT — see [LICENSE](LICENSE).
