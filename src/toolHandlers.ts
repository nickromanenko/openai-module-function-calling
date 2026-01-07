import { ORDERS } from "./data/orders.js";

export function getOrder(orderId: string) {
    return ORDERS.find((o) => o.id === orderId) ?? null;
}

export function listOrdersByEmail(email: string) {
    return ORDERS.filter((o) => o.email.toLowerCase() === email.toLowerCase());
}
