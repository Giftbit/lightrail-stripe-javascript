export interface CreateSplitTenderChargeParams {
    userSuppliedId: string;
    currency: string;
    amount: number;
    shopperId?: string;
    source?: string;
    customer?: string;
    metadata?: object;
}
