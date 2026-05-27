import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import reconcileRoutes from "./routes/reconcile.routes";
import { connectDB } from "./config/db";


const app = express();

// Trust reverse proxy - For Vercel
app.set("trust proxy", 1);

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

//Using middleware to connect to DB because vercel is failing to connect
app.use(async (req, res, next) => {
    await connectDB();
    next();
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