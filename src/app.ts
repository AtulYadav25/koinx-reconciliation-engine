import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import reconcileRoutes from "./routes/reconcile.routes";

const app = express();

// Trust reverse proxy - For Vercel
app.set("trust proxy", true);

/** Global limiter – applied to every route */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        status: 429,
        error: "Too many requests. Please try again later.",
    },
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        status: 429,
        error: "Too many reconcile requests. Please slow down.",
    },
});

app.use(globalLimiter);
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("KoinX Reconciliation Engine API 🚀");
});

// Reconcile Routes
app.use("/api/v1/reconcile", apiLimiter, reconcileRoutes);

export default app;