import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_queue",
  title: "List queue",
  description: "List the songs currently in the jukebox queue, in play order (the first one is playing now).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("queue")
      .select("id, title, artist, requested_by, created_at")
      .order("created_at", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const songs = (data ?? []).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      artist: String(r.artist),
      requested_by: String(r.requested_by),
      created_at: String(r.created_at),
    }));
    return {
      content: [{ type: "text", text: songs.length ? JSON.stringify(songs) : "The queue is empty." }],
      structuredContent: { songs },
    };
  },
});
