import {Transaction} from "lightrail-client/dist/model";

export interface StripeLightrailSplitTenderCharge {
    lightrailTransaction: Transaction;
    stripeCharge: any;
}