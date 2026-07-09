import { NextResponse } from "next/server";
import {
  canUseReview,
  getCandidate,
} from "@/features/import-review/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

type GLMResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function cleanContent(content: string) {
  return content
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLocalTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function responseText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim() ?? "";
}

function glmResponseText(response: GLMResponse) {
  return response.choices?.[0]?.message?.content?.trim() ?? "";
}

function compactSummary(summary: string) {
  return summary
    .replace(/^["“”'「」]+|["“”'「」]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function summarySystemPrompt() {
  return "你在帮一对情侣整理私密聊天回忆。逐条阅读聊天，只根据原文生成一句简短中文小评语。要求：不超过36个中文字；温柔、克制、具体；不要编造地点、关系进展或未出现的事件；不要输出标题、引号、解释、编号、多个选项或多句。";
}

async function generateWithOpenAI(lines: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，请先在 .env.local 中配置。");
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.5",
      input: [
        {
          role: "developer",
          content: summarySystemPrompt(),
        },
        {
          role: "user",
          content: `请为下面这段聊天生成一句可编辑的记忆摘要短评：\n\n${lines}`,
        },
      ],
      max_output_tokens: 120,
    }),
  });
  const result = (await response.json()) as OpenAIResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(result.error?.message ?? "AI 生成失败。");
  }
  return responseText(result);
}

async function generateWithGLM(lines: string) {
  const apiKey = process.env.GLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 GLM_API_KEY，请先在 .env.local 中配置。");
  }
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GLM_MODEL?.trim() || "glm-4.7-flash",
      thinking: { type: "disabled" },
      messages: [
        {
          role: "system",
          content: summarySystemPrompt(),
        },
        {
          role: "user",
          content: `请为下面这段聊天生成一句可编辑的记忆摘要短评，只返回一句话：\n\n${lines}`,
        },
      ],
    }),
  });
  const result = (await response.json()) as GLMResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(result.error?.message ?? "AI 生成失败。");
  }
  return glmResponseText(result);
}

async function generateSummary(lines: string) {
  const provider = process.env.AI_SUMMARY_PROVIDER?.trim().toLowerCase() || "glm";
  if (provider === "openai") return generateWithOpenAI(lines);
  if (provider === "glm") return generateWithGLM(lines);
  throw new Error("AI_SUMMARY_PROVIDER 只能是 glm 或 openai。");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { id } = await params;
    const detail = await getCandidate(id);
    if (!detail) {
      return NextResponse.json({ error: "没有找到这个候选事件。" }, { status: 404 });
    }
    if (detail.candidate.sourceType === "photo") {
      return NextResponse.json(
        { error: "照片候选没有聊天记录，不能生成聊天短评。" },
        { status: 400 },
      );
    }

    const selectedIds = new Set(
      detail.candidate.selectedMessageIds.length
        ? detail.candidate.selectedMessageIds
        : detail.candidate.messageIds,
    );
    const chatLines = detail.messages
      .filter(
        (message) =>
          selectedIds.has(message.id) &&
          (message.senderRole === "self" || message.senderRole === "partner") &&
          !["system", "emoji"].includes(message.renderType),
      )
      .map((message) => ({
        speaker: message.senderRole === "self" ? "我" : "对方",
        time: formatLocalTime(message.sentAt),
        content: cleanContent(message.content),
        quote: message.quote?.content ? cleanContent(message.quote.content) : "",
      }))
      .filter((message) => message.content || message.quote);

    if (!chatLines.length) {
      return NextResponse.json(
        { error: "这段候选里没有可用于生成短评的文字聊天。" },
        { status: 400 },
      );
    }

    const lines = chatLines
      .map((message, index) => {
        const quote = message.quote ? `；引用：${message.quote}` : "";
        return `${index + 1}. ${message.time} ${message.speaker}：${message.content}${quote}`;
      })
      .join("\n")
      .slice(0, 28_000);

    const summary = compactSummary(await generateSummary(lines));
    if (!summary) throw new Error("AI 没有返回可用短评。");
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 生成失败。" },
      { status: 400 },
    );
  }
}
