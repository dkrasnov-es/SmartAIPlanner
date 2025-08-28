// Simple Task Manager powered by Gemini API
// Uses a local proxy at /api/gemini to avoid CORS and protect API key

// Register Service Worker for PWA offline and installability
if ("serviceWorker" in navigator) {
window.addEventListener("load", () => {
navigator.serviceWorker.register("./service-worker.js").catch(console.error);
});
}

// Handle install prompt (Android/desktop browsers)
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
event.preventDefault();
deferredPrompt = event;
const btn = document.getElementById("installBtn");
if (btn) {
btn.hidden = false;
btn.onclick = async () => {
try { await deferredPrompt.prompt(); await deferredPrompt.userChoice; }
finally { btn.hidden = true; deferredPrompt = null; }
};
}
});

document.addEventListener("DOMContentLoaded", () => {
// Wire up form submission to call Gemini and render checklist
const form = document.getElementById("goalForm");
const input = document.getElementById("goalInput");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("tasks");

if (!form || !input || !statusEl || !listEl) return;

form.addEventListener("submit", async (e) => {
e.preventDefault();
const goal = String(input.value || "").trim();
if (!goal) return;
statusEl.textContent = "Думаю…";
listEl.innerHTML = "";
try {
const tasks = await fetchTasksFromGemini(goal);
renderTasks(listEl, tasks);
statusEl.textContent = tasks.length ? "" : "Задачи не найдены.";
} catch (err) {
console.error(err);
statusEl.textContent = (err && err.message) ? err.message : "Не удалось получить задачи. Проверьте подключение к интернету или API ключ.";
}
});
});

// Calls local proxy to break the goal into 3–5 tasks
async function fetchTasksFromGemini(goal) {
// Compose a simple instruction; ask for bullet list for easy parsing
// Detect if the goal is in Russian (contains Cyrillic characters)
const isRussian = /[\u0400-\u04FF]/.test(goal);
const languageInstruction = isRussian
  ? "Respond in Russian. Break down this goal into 3–5 achievable tasks"
  : "Break down this goal into 3–5 achievable tasks";

const prompt = `${languageInstruction}: ${goal}. Return either a bullet list or a JSON array of strings.`;
const res = await fetch(`/api/gemini`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ goal, prompt })
});
if (!res.ok) {
throw new Error(`Gemini API error: ${res.status}`);
}
const data = await res.json();
// Extract primary text from server response
const text = data?.text || "";
return normalizeToTaskArray(text);
}

// Converts Gemini free-text (bullet list or JSON) into an array of task strings
function normalizeToTaskArray(text) {
const trimmed = String(text || "").trim();

// Clean up common JSON formatting artifacts
let cleanText = trimmed
  .replace(/^```(?:json)?\s*\n?/i, '')  // Remove code block markers
  .replace(/\n?```\s*$/, '')            // Remove closing code blocks
  .replace(/^\[|\]$/g, '')             // Remove outer brackets
  .replace(/"\s*,\s*"/g, '\n')         // Convert JSON commas to newlines
  .replace(/^"|"$/gm, '')              // Remove quotes from start/end of lines
  .trim();

// Try JSON first
try {
const maybe = JSON.parse(trimmed);
if (Array.isArray(maybe)) {
return maybe.map(x => String(x)).filter(Boolean);
}
} catch {}

// Fallback: parse bullet/numbered list or cleaned text into items
const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const tasks = [];
for (const line of lines) {
const m = line.match(/^(?:[-*•]\s+|\d+[.)]\s+)?(.+)$/);
if (m && m[1]) tasks.push(m[1].trim());
}
return tasks;
}

// Renders tasks as a checklist with checkboxes
function renderTasks(listEl, tasks) {
listEl.innerHTML = "";
for (let i = 0; i < tasks.length; i++) {
const li = document.createElement("li");
li.className = "task-item";
const checkbox = document.createElement("input");
checkbox.type = "checkbox";
checkbox.id = `task_${i}`;
const label = document.createElement("label");
label.setAttribute("for", checkbox.id);
label.textContent = tasks[i];
li.appendChild(checkbox);
li.appendChild(label);
listEl.appendChild(li);
}
}
