# Mercor Insights Hub

I like this idea because it solves a real problem: information asymmetry. The people who consistently do well on Mercor are often the ones who notice changes early.

Here’s what I’d build.

Mercor Intelligence

A private AI agent that continuously gathers, filters, and summarizes everything that matters about Mercor.

Source Layer

The agent would monitor:

Official Mercor blog and announcements

CEO and leadership posts on X

LinkedIn posts mentioning Mercor

Reddit communities

r/mercor_ai

r/Mercor_contractors

relevant AI and freelancing subreddits

TechCrunch

Forbes

Hacker News

GitHub (for Mercor engineering repositories if any become public)

YouTube videos discussing Mercor

Google News



Intelligence Layer

Instead of just collecting links, the AI would answer questions like:

Hiring

Are more engineers being hired this week?

Which countries are receiving invitations?

Which technical skills are appearing most often?

Projects

New project names

New evaluation types

New interview formats

New AI domains

Money

Pay increases

Pay reductions

Delayed payments

High-paying projects

Community

People getting accepted

People getting rejected

Common mistakes

Best practices

Company

Fundraising

Acquisitions

Leadership changes

Product launches



Your Daily Brief

Every morning, you’d receive something like:

Mercor Daily Intelligence — July 16

18 new Reddit discussions

4 engineers reported invitations to a new RLHF project.

Mercor appears to be increasing demand for Python + AI agents.

One new engineering assessment reported.

No widespread payment issues reported.

CEO hinted at expansion into healthcare evaluations.

Confidence score: High.

Then an “Action Items” section:

Update your Mercor profile with MCP experience.

Apply for the new AI Engineering pool.

Prepare for multi-agent evaluation tasks.



Weekly Deep Report

Every Sunday:

Hiring trends

Skills in demand

Interview changes

Compensation trends

Risk alerts

Recommended learning topics

Predicted opportunities for the coming week



AI Q&A

You could ask:

“What’s changed since yesterday?”

“What are software engineers saying this week?”

“Are there new Python projects?”

“Has anyone mentioned Flutter?”

“What’s the highest-paying project this month?”

“Summarize all CEO posts from this week.”



Tech Stack

Since you’re already comfortable with AI and software engineering, I’d keep it simple and modular:

Data collection: Scheduled crawlers and RSS where available

Storage: PostgreSQL (or Supabase if you want managed hosting)

Embeddings: Vector database for semantic search

LLM: GPT-5.5 or another model for summarization and trend analysis

Workflow orchestration: n8n or a Python-based scheduler

Dashboard: Lovable for a fast MVP, then a custom Flutter web/mobile app later

Notifications: Telegram, WhatsApp, email, or Slack



Phase 2: AI Contractor Intelligence

Once Mercor is working well, we could expand it into a broader platform covering:

Mercor

Outlier

Alignerr

Invisible Technologies

Turing

DataAnnotation

Scale AI

Surge AI

Appen

Deel contractor opportunities

Then it becomes an AI Contractor Intelligence Platform, not just a Mercor tracker.

That has much bigger potential—you could even turn it into a subscription product for AI contractors who want curated, actionable intelligence instead of spending hours searching multiple sites.

I suggest we build this in four phases:

MVP (1–2 days): Daily news aggregation, Reddit monitoring, AI summaries, and email/Telegram reports.

Intelligence Engine: Trend detection, sentiment analysis, duplicate removal, and confidence scoring.

Interactive Dashboard: Searchable history, charts, alerts, and natural-language Q&A.

Multi-platform Expansion: Add other AI work platforms and compare trends across them.

This approach gets something useful into your hands quickly, while leaving room to evolve it into a much more powerful intelligence product.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7995cdbb-e47d-4485-a5f3-a179d81b23c9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
