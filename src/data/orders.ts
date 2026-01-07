export type Order = {
    id: string;
    email: string;
    status: "processing" | "shipped" | "delivered" | "canceled";
    etaDays?: number;
    trackingNumber?: string;
};

export const ORDERS: Order[] = [
    {
        id: "A1001",
        email: "nick@bosar.agency",
        status: "shipped",
        etaDays: 3,
        trackingNumber: "TRK-111",
    },
    {
        id: "A1002",
        email: "nick@bosar.agency",
        status: "processing",
        etaDays: 7,
    },
    { id: "B2001", email: "bohdan@bosar.agency", status: "delivered" },
];
