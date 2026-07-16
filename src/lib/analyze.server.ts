import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAi, embedText } from "./ai-gateway.server";

const AnalysisSchema = z.object({
  bucket: z.enum(["Hiring", "Projects", "Money", "Community", "Company", "Noise"]),
  summary: z.string(),
  skills: z.array(z.string()),
  countries: z.array(z.string()),
  project_names: z.array(z.string()),
  pay_amount: z.number().nullable(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  signal_score: z.number(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const SYSTEM = `You classify posts and articles about Mercor (the AI talent marketplace).
Buckets:
- Hiring: invitations, interview activity, acceptance/rejection reports, engineer intake.
- Projects: new project names, evaluation types, interview formats, AI domains, RLHF/tasks.
- Money: pay rates, pay changes, delayed payments, high-paying opportunities.
- Community: tips, best practices, common mistakes, general contractor chatter.
- Company: fundraising, acquisitions, leadership changes, product launches, PR.
- Noise: unrelated, spam, generic AI content with no Mercor signal.

Return concise, factual summary (max 2 sentences). Extract skills (Python, RLHF, MCP, Flutter etc.), countries mentioned, project names. Pay amount in USD if any explicit rate; else null.
signal_score 0-100: how actionable/informative for a Mercor contractor.`;

export async function analyzeItem(input: {
  title: string;
  body: string | null;
  source: string;
  url: string;
}): Promise<{ analysis: Analysis; embedding: number[] | null }> {
  const gateway = createLovableAi();
  const model = gateway("google/gemini-3-flash-preview");
  const prompt = `Source: ${input.source}\nTitle: ${input.title}\n\n${(input.body ?? "").slice(0, 4000)}`;

  let analysis: Analysis;
  try {
    const { output } = await generateText({
      model,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: AnalysisSchema }),
    });
    analysis = output;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      analysis = {
        bucket: "Noise",
        summary: input.title,
        skills: [],
        countries: [],
        project_names: [],
        pay_amount: null,
        sentiment: "neutral",
        signal_score: 0,
      };
    } else {
      throw err;
    }
  }

  const embedding = await embedText(`${input.title}\n${analysis.summary}`);
  return { analysis, embedding };
}