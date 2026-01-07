export const tools = [
    {
        type: "function" as const,
        name: "get_order",
        description: "Get an order by its id.",
        strict: null,
        parameters: {
            type: "object",
            properties: {
                orderId: { type: "string", description: "Order id like A1001" },
            },
            required: ["orderId"],
        },
    },
    {
        type: "function" as const,
        name: "list_orders_by_email",
        description: "List recent orders for a customer email.",
        strict: null,
        parameters: {
            type: "object",
            properties: {
                email: { type: "string", description: "Customer email" },
            },
            required: ["email"],
        },
    },
];
