import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listQueueTool from "./tools/list-queue";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "jukebox-vibes",
  title: "JukeBox Vibes",
  version: "0.1.0",
  instructions: "Tools for the Golphe JukeBox. Use `list_queue` to see what is playing and what comes next.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listQueueTool],
});
