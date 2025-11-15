import express from "express";
import cron from "node-cron";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Make sure you set this environment variable
const DB_URL = process.env.FIREBASE_DB_URL;

if (!DB_URL) {
    console.error("❌ FIREBASE_DB_URL is not set. Exiting.");
    process.exit(1);
}

const TWO_MINUTES = 2 * 60 * 1000; // 2 minutes in ms

// Cron job: runs every 10 seconds (for testing)
cron.schedule("*/10 * * * * *", async () => {
    try {
        console.log("⏱ Checking delivered orders...");

        const res = await fetch(`${DB_URL}/orders.json`);
        if (!res.ok) {
            console.error("❌ Failed to fetch orders:", res.status, res.statusText);
            return;
        }

        const orders = await res.json();
        if (!orders) {
            console.log("⚠️ No orders found.");
            return;
        }

        const now = Date.now();

        for (const orderId in orders) {
            const order = orders[orderId];

            if (order.status === "Delivered" && order.deliveredAt) {
                const deliveredAt = Number(order.deliveredAt);

                if (isNaN(deliveredAt)) {
                    console.warn(`⚠️ Order ${orderId} has invalid deliveredAt:`, order.deliveredAt);
                    continue;
                }

                if (now - deliveredAt >= TWO_MINUTES) {
                    // Move to history
                    const putRes = await fetch(`${DB_URL}/orderHistory/${orderId}.json`, {
                        method: "PUT",
                        body: JSON.stringify({ ...order, status: "Completed" })
                    });

                    if (!putRes.ok) {
                        console.error("❌ Failed to move order to history:", orderId);
                        continue;
                    }

                    // Remove from active orders
                    const delRes = await fetch(`${DB_URL}/orders/${orderId}.json`, {
                        method: "DELETE"
                    });

                    if (!delRes.ok) {
                        console.error("❌ Failed to delete order:", orderId);
                        continue;
                    }

                    console.log("✅ Auto moved order:", orderId);
                }
            }
        }
    } catch (err) {
        console.error("❌ Cron job error:", err);
    }
});

app.get("/", (req, res) => {
    res.send("VPMONLINE auto-move backend is running.");
});

app.listen(10000, () => {
    console.log("🚀 Server running at port 10000");
});
