import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { tools } from "./tools";
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

    // Limit tool loops so we don't spin forever
    for (let step = 0; step < 5; step++) {
        const response = await openai.responses.create({
            model: MODEL,
            tools,
            input,
            // tool_choice can guide behavior; we keep auto for now
        });

        // If we got a final text answer, return it
        if (response.output_text?.trim()) {
            return res.json({ answer: response.output_text });
        }

        // Otherwise handle tool calls
        const toolCalls =
            response.output?.filter((x: any) => x.type === "function_call") ??
            [];
        if (toolCalls.length === 0) {
            // Nothing to do; avoid silent failure
            return res
                .status(500)
                .json({ error: "No output_text and no tool calls." });
        }

        // Append the model output items to input (so the model remembers what it asked)
        input.push(...response.output);

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

    return res.status(500).json({ error: "Tool loop limit reached." });
});

app.listen(3000, () =>
    console.log("[+] API listening on http://localhost:3000")
);
