import express from "express";
import cors from "cors";
import reconcileRoutes from "./routes/reconcile.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("KoinX Reconciliation Engine API 🚀");
});

// Reconcile Routes
app.use("/api/v1/reconcile", reconcileRoutes);

export default app;