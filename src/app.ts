import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { tools } from "./tools";
import { zodTextFormat } from "openai/helpers/zod";
import { SupportResponseSchema } from "./schemas/supportResponse";
import { getOrder, listOrdersByEmail } from "./toolHandlers";

const app = express();
app.use(express.json({ limit: "1mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.MODEL ?? "gpt-5";

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

app.listen(3000, () =>
    console.log("[+] API listening on http://localhost:3000")
);
