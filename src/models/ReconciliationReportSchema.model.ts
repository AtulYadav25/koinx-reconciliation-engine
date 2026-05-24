import mongoose, { Schema, Document } from 'mongoose';

export interface IReconciliationReport extends Document {
    runId: mongoose.Types.ObjectId;
    category: 'Matched' | 'Conflicting' | 'Unmatched-User' | 'Unmatched-Exchange';
    reason: string;
    userTransaction: Record<string, unknown> | null;
    exchangeTransaction: Record<string, unknown> | null;
}

const ReconciliationReportSchema: Schema = new Schema(
    {
        runId: {
            type: Schema.Types.ObjectId,
            ref: "ReconciliationRun",
            required: true
        },

        category: {
            type: String,
            enum: [
                "Matched",
                "Conflicting",
                "Unmatched-User",
                "Unmatched-Exchange"
            ],
            required: true
        },

        reason: {
            type: String,
            required: true
        },

        userTransaction: {
            type: Schema.Types.Mixed,
            default: null
        },

        exchangeTransaction: {
            type: Schema.Types.Mixed,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Index for efficient report queries
ReconciliationReportSchema.index({ runId: 1, category: 1 });

export const ReconciliationReport =
    mongoose.model<IReconciliationReport>(
        'ReconciliationReport',
        ReconciliationReportSchema
    );