import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('5000'),
    MONGO_URI: z.string().min(1),

    // Reconciliation defaults — overridable per-request via POST /reconcile body
    TIMESTAMP_TOLERANCE_SECONDS: z
        .string()
        .default('300')
        .transform(Number),
    QUANTITY_TOLERANCE_PCT: z
        .string()
        .default('0.01')
        .transform(Number),
});

const _env = envSchema.safeParse(process.env);

console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
console.log(_env.data);

if (!_env.success) {
    console.error("Invalid environment variables:", _env.error.format());
    process.exit(1);
}

export const config = _env.data;