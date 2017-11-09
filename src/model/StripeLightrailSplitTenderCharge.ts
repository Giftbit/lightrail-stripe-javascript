import {Transaction} from "lightrail-client/dist/model";
import * as stripe from "stripe";

export interface StripeLightrailSplitTenderCharge {
    lightrailTransaction: Transaction;
    stripeThing: stripe.charges.ICharge;
}