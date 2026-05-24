import mongoose, { Schema, Document } from 'mongoose';

export interface IReconciliationRun extends Document {
    config: {
        timestampToleranceSeconds: number;
        quantityTolerancePct: number;
    };
    status: 'processing' | 'completed' | 'failed';
    summary: {
        matched: number;
        conflicting: number;
        unmatchedUser: number;
        unmatchedExchange: number;
    };
    ingestion: {
        totalUser: number;
        totalExchange: number;
        flaggedUser: number;
        flaggedExchange: number;
        errors: string[];
    };
    startedAt: Date;
    completedAt: Date | null;
}

const ReconciliationRunSchema: Schema = new Schema(
    {
        config: {
            timestampToleranceSeconds: {
                type: Number,
                required: true
            },
            quantityTolerancePct: {
                type: Number,
                required: true
            }
        },

        status: {
            type: String,
            enum: ['processing', 'completed', 'failed'],
            default: 'processing'
        },

        summary: {
            matched: {
                type: Number,
                default: 0
            },
            conflicting: {
                type: Number,
                default: 0
            },
            unmatchedUser: {
                type: Number,
                default: 0
            },
            unmatchedExchange: {
                type: Number,
                default: 0
            },
        },

        ingestion: {
            totalUser: { type: Number, default: 0 },
            totalExchange: { type: Number, default: 0 },
            flaggedUser: { type: Number, default: 0 },
            flaggedExchange: { type: Number, default: 0 },
            errors: { type: [String], default: [] },
        },

        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

export const ReconciliationRun = mongoose.model<IReconciliationRun>('ReconciliationRun', ReconciliationRunSchema);