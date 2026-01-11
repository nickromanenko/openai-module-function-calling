import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { tools } from "./tools";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { SupportResponseSchema } from "./schemas/supportResponse";
import { getOrder, listOrdersByEmail } from "./toolHandlers";

const app = express();
app.use(express.json({ limit: "1mb" }));
// Serve static files (for the streaming demo HTML page)
app.use(express.static("public"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.MODEL ?? "gpt-5-nano";

app.post("/support", async (req, res) => {
    const question = req.body?.question;
    if (typeof question !== "string" || question.trim().length < 3) {
        return res.status(400).json({ error: "question must be a string" });
    }

    // Conversation input we will append to
    const input: any[] = [
        {
            role: "developer",
            content:
                "You are an order support assistant.\n" +
                "- Use tools to retrieve order data.\n" +
                "- Never invent order status.\n" +
                "- If you don't have enough info, ask one clarifying question.\n",
        },
        { role: "user", content: question },
    ];

    for (let step = 0; step < 5; step++) {
        const response = await openai.responses.create({
            model: MODEL,
            tools,
            input,
            parallel_tool_calls: false,

            // tool_choice can guide behavior; we keep auto for now
        });

        // Otherwise handle tool calls
        const toolCalls =
            (response.output ?? [])?.filter(
                (x: any) => x.type === "function_call"
            ) ?? [];

        if (toolCalls.length === 0) {
            break;
        }

        // Append the model output items to input (so the model remembers what it asked)
        input.push(...(response.output ?? []));

        for (const call of toolCalls) {
            let output: any = null;
            try {
                const args = JSON.parse((call as any).arguments ?? "{}");
                if ((call as any).name === "get_order") {
                    output = getOrder(String(args.orderId));
                } else if ((call as any).name === "list_orders_by_email") {
                    output = listOrdersByEmail(String(args.email));
                } else {
                    output = { error: `Unknown tool: ${(call as any).name}` };
                }
            } catch (e: any) {
                output = {
                    error: "Bad tool arguments",
                    details: e?.message ?? String(e),
                };
            }

            input.push({
                type: "function_call_output",
                call_id: (call as any).call_id,
                output: JSON.stringify(output),
            });
        }
    }

    const parsed = await openai.responses.parse({
        model: MODEL,
        input: [
            ...input,
            {
                role: "developer",
                content:
                    "Now produce the final answer as STRICT JSON matching the schema. " +
                    "If you asked a clarifying question, set needsMoreInfo=true and put it in clarifyingQuestion.",
            },
        ],
        text: {
            format: zodTextFormat(SupportResponseSchema, "support_response"),
        },
        max_output_tokens: 1200,
    });

    return res.json(parsed.output_parsed);
});

app.get("/support-stream", async (req, res) => {
    const question = String(req.query.question ?? "").trim();
    if (question.length < 3) {
        return res
            .status(400)
            .json({ error: "question query param is required" });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    res.write(`event: ready\ndata: ok\n\n`);

    let closed = false;
    req.on("close", () => {
        closed = true;
    });

    try {
        const stream = await openai.responses.create({
            model: MODEL,
            input: [
                {
                    role: "developer",
                    content:
                        "You are an order support assistant. Be concise. " +
                        "If you need more info, ask one clarifying question.",
                },
                { role: "user", content: question },
            ],
            max_output_tokens: 3000,
            stream: true,
        });

        for await (const event of stream as any) {
            if (closed) {
                break;
            }

            // Stream text deltas to the client
            if (event.type === "response.output_text.delta") {
                res.write(
                    `event: delta\ndata: ${JSON.stringify(event.delta)}\n\n`
                );
            }

            if (event.type === "response.created") {
                res.write(
                    `event: meta\ndata: ${JSON.stringify({
                        responseId: event.response.id,
                    })}\n\n`
                );
            }

            if (event.type === "response.completed") {
                res.write(`event: done\ndata: ok\n\n`);
                break;
            }

            if (event.type === "error" || event.type === "response.failed") {
                res.write(`event: error\ndata: ${JSON.stringify(event)}\n\n`);
                break;
            }
        }
    } catch (err: any) {
        res.write(
            `event: error\ndata: ${JSON.stringify({
                message: err?.message ?? String(err),
            })}\n\n`
        );
    } finally {
        res.end();
    }
});

app.get("/support-stream-final", async (req, res) => {
    const question = String(req.query.question ?? "").trim();
    if (question.length < 3)
        return res.status(400).json({ error: "question required" });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const input: any[] = [
        {
            role: "developer",
            content:
                "You are order support. Use tools. Never invent order status.",
        },
        { role: "user", content: question },
    ];

    // --- Phase 1: tool calls (non-streaming) ---
    const first = await openai.responses.create({
        model: MODEL,
        tools, // from Lesson 4
        input,
        parallel_tool_calls: false,
    });

    input.push(...(first.output ?? []));

    for (const item of first.output ?? []) {
        if (item.type !== "function_call") continue;

        res.write(
            `event: status\ndata: ${JSON.stringify(
                `Calling ${item.name}...`
            )}\n\n`
        );

        const args = JSON.parse(item.arguments ?? "{}");
        const toolResult =
            item.name === "get_order"
                ? getOrder(String(args.orderId))
                : item.name === "list_orders_by_email"
                ? listOrdersByEmail(String(args.email))
                : { error: `Unknown tool: ${item.name}` };

        input.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: JSON.stringify(toolResult),
        });

        res.write(
            `event: status\ndata: ${JSON.stringify(
                `Tool ${item.name} done`
            )}\n\n`
        );
    }

    // --- Phase 2: final answer (streaming) ---
    const stream = await openai.responses.create({
        model: MODEL,
        input,
        stream: true,
        // optional: tools: []  // keep it simple: no more tools during final answer
    });

    for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
            res.write(`event: delta\ndata: ${JSON.stringify(event.delta)}\n\n`);
        }
        if (event.type === "response.completed") {
            res.write(`event: done\ndata: "ok"\n\n`);
            break;
        }
        if (event.type === "response.failed" || event.type === "error") {
            res.write(`event: error\ndata: ${JSON.stringify(event)}\n\n`);
            break;
        }
    }

    res.end();
});

const FinalSchema = z.object({
    answer: z.string(),
    order: z
        .object({
            id: z.string(),
            status: z.enum(["processing", "shipped", "delivered", "canceled"]),
            etaDays: z.number().int().nonnegative().optional(),
            trackingNumber: z.string().optional(),
        })
        .nullable(),
    nextSteps: z.array(z.string()).max(5),
    needsMoreInfo: z.boolean(),
    clarifyingQuestion: z.string().nullable(),
});

app.get("/support-stream-structured", async (req, res) => {
    const question = String(req.query.question ?? "").trim();
    if (question.length < 3)
        return res.status(400).json({ error: "question required" });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    res.write(`event: ready\ndata: "ok"\n\n`);

    let closed = false;
    req.on("close", () => (closed = true));

    const input: any[] = [
        {
            role: "developer",
            content:
                "You are order support.\n" +
                "- Use tools to retrieve order data.\n" +
                "- Never invent order status.\n" +
                "- If info is missing, ask one clarifying question.\n",
        },
        { role: "user", content: question },
    ];

    try {
        // ---- Phase 1: tools (non-streaming) ----
        const first = await openai.responses.create({
            model: MODEL,
            tools,
            input,
            parallel_tool_calls: false,
        });

        res.write(
            `event: meta\ndata: ${JSON.stringify({ responseId: first.id })}\n\n`
        );

        input.push(...(first.output ?? []));

        for (const item of first.output ?? []) {
            if (closed) return res.end();
            if (item.type !== "function_call") continue;

            res.write(
                `event: status\ndata: ${JSON.stringify(
                    `Calling ${item.name}...`
                )}\n\n`
            );

            const args = JSON.parse(item.arguments ?? "{}");
            const toolResult =
                item.name === "get_order"
                    ? getOrder(String(args.orderId))
                    : item.name === "list_orders_by_email"
                    ? listOrdersByEmail(String(args.email))
                    : { error: `Unknown tool: ${item.name}` };

            input.push({
                type: "function_call_output",
                call_id: item.call_id,
                output: JSON.stringify(toolResult),
            });

            res.write(
                `event: status\ndata: ${JSON.stringify(
                    `Tool ${item.name} done`
                )}\n\n`
            );
        }

        // ---- Phase 2: stream the human-facing answer ----
        let answerBuffer = "";

        const stream = await openai.responses.create({
            model: MODEL,
            input: [
                ...input,
                {
                    role: "developer",
                    content:
                        "Now answer the user. Be concise and helpful. " +
                        "If you need more info, ask one clarifying question.",
                },
            ],
            stream: true,
            max_output_tokens: 400,
        });

        for await (const event of stream) {
            if (closed) return res.end();

            if (event.type === "response.output_text.delta") {
                answerBuffer += event.delta;
                res.write(
                    `event: delta\ndata: ${JSON.stringify(event.delta)}\n\n`
                );
            }

            if (event.type === "response.completed") {
                break;
            }

            if (event.type === "response.failed" || event.type === "error") {
                res.write(`event: error\ndata: ${JSON.stringify(event)}\n\n`);
                return res.end();
            }
        }

        // ---- Phase 3: produce strict JSON (Structured Outputs) ----
        // We feed back the streamed answer as context so JSON matches what user saw.

        res.write(`event: done\ndata: "ok"\n\n`);
        res.end();
    } catch (err: any) {
        res.write(
            `event: error\ndata: ${JSON.stringify({
                message: err?.message ?? String(err),
            })}\n\n`
        );
        res.end();
    }
});

app.listen(3000, () =>
    console.log("[+] API listening on http://localhost:3000")
);
