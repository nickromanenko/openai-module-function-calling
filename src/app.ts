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

    const response = await openai.responses.create({
        model: MODEL,
        tools,
        input,
        // tool_choice can guide behavior; we keep auto for now
    });
    return res.json(response);
});

app.listen(3000, () =>
    console.log("[+] API listening on http://localhost:3000")
);
