// Thin fetch wrapper for the frontend. Never throws on an HTTP error --
// callers get back a decision-shaped object either way, matching what
// lib/decide.js guarantees on the server.

export async function fetchEngineStatus() {
  try {
    const res = await fetch("/api/engine-status");
    if (!res.ok) return { engine: "plain" };
    return await res.json();
  } catch {
    return { engine: "plain" };
  }
}

export async function requestDecision({ policy, request, order }) {
  try {
    const res = await fetch("/api/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy, request, order }),
    });
    if (res.status === 429) {
      return { error: "Too many requests from here in the last minute. Wait a moment, then press Decide again." };
    }
    if (!res.ok) {
      return { error: "Stet couldn't decide this one. Try again in a moment." };
    }
    return { decision: await res.json() };
  } catch {
    return { error: "Couldn't reach Stet. Check your connection and try again." };
  }
}
