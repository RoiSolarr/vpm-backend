import express from "express";
import cron from "node-cron";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const DB_URL = "https://vpmonline-99ca1-default-rtdb.asia-southeast1.firebasedatabase.app";

// run every 15 minutes/ change to 10sec for trial
cron.schedule("*/10 * * * * *", async () => {

    console.log("Checking delivered orders...");

    const orders = await fetch(`${DB_URL}/orders.json`).then(r => r.json());

    if (!orders) return;

    const now = Date.now();
    const oneDay = 2 * 60 * 1000; // 2 minutes

    for (const orderId in orders) {
        const order = orders[orderId];

        if (order.status === "Delivered" && order.deliveredAt) {
            if (now - order.deliveredAt >= oneDay) {

                // move to history
                await fetch(`${DB_URL}/orderHistory/${orderId}.json`, {
                    method: "PUT",
                    body: JSON.stringify({ ...order, status: "Completed" })
                });

                // remove from active
                await fetch(`${DB_URL}/orders/${orderId}.json`, {
                    method: "DELETE"
                });

                console.log("Auto moved:", orderId);
            }
        }
    }
});

app.get("/", (req, res) => {
    res.send("VPMONLINE auto-move backend is running.");
});

app.listen(10000, () => {
    console.log("Server running at port 10000");
});
