const GATEWAY = "https://connector-gateway.lovable.dev/slack/api";

export async function postSlackMessage(text: string, channel?: string) {
  const key = process.env.LOVABLE_API_KEY;
  const slackKey = process.env.SLACK_API_KEY;
  const targetChannel = channel ?? process.env.SLACK_CHANNEL_ID;
  if (!key || !slackKey) {
    console.warn("Slack: missing keys");
    return { ok: false, error: "missing_keys" };
  }
  if (!targetChannel) {
    console.warn("Slack: no SLACK_CHANNEL_ID set");
    return { ok: false, error: "missing_channel" };
  }
  const res = await fetch(`${GATEWAY}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Connection-Api-Key": slackKey,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: targetChannel,
      text,
      unfurl_links: false,
      username: "Mercor Intelligence",
    }),
  });
  const body = await res.text();
  try {
    const parsed = JSON.parse(body);
    if (!parsed.ok) console.error("Slack error:", parsed.error, body.slice(0, 400));
    return parsed;
  } catch {
    return { ok: false, error: `non-json ${res.status}` };
  }
}