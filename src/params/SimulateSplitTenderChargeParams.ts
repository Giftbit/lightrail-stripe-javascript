export interface SimulateSplitTenderChargeParams {
    userSuppliedId: string;
    currency: string;
    amount: number;
    shopperId?: string;
    source?: string;
    customer?: string;
    metadata?: { [key: string]: any };
    nsf?: boolean;
}
