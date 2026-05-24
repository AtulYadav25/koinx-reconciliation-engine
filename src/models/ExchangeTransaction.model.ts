import mongoose, { Schema, Document } from 'mongoose';

export interface IExchangeTransaction extends Document {
    runId: mongoose.Types.ObjectId;
    transaction_id: string;
    timestamp: Date | null;
    type: string;
    asset: string;
    quantity: number | null;
    price_usd: number | null;
    fee: number | null;
    note: string;
    raw: Record<string, string>;
    flagged: boolean;
    qualityIssues: string[];
}

const ExchangeTransactionSchema: Schema = new Schema(
    {
        runId: {
            type: Schema.Types.ObjectId,
            ref: "ReconciliationRun",
            required: true
        },
        transaction_id: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: null,
        },
        type: {
            type: String,
            default: '',
        },
        asset: {
            type: String,
            default: '',
        },
        quantity: {
            type: Number,
            default: null,
        },
        price_usd: {
            type: Number,
            default: null,
        },
        fee: {
            type: Number,
            default: null,
        },
        note: {
            type: String,
            default: '',
        },

        // Raw original CSV row values (for debugging / audit trail)
        raw: {
            type: Schema.Types.Mixed,
            default: {}
        },

        // Data quality flags
        flagged: {
            type: Boolean,
            default: false
        },
        qualityIssues: {
            type: [String],
            default: []
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient matching queries
ExchangeTransactionSchema.index({ runId: 1, asset: 1, type: 1 });
ExchangeTransactionSchema.index({ runId: 1, flagged: 1 });

export const ExchangeTransaction = mongoose.model<IExchangeTransaction>('ExchangeTransaction', ExchangeTransactionSchema);