import {Transaction} from "lightrail-client/dist/model";
import {charges} from "stripe";

export interface StripeLightrailSplitTenderCharge {
    lightrailTransaction: Transaction;
    stripeCharge: charges.ICharge;
}