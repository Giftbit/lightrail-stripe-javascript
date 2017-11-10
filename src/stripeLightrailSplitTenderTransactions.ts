import * as lightrail from "lightrail-client";

import {StripeLightrailSplitTenderCharge} from "./model/StripeLightrailSplitTenderCharge";
import {CreateSplitTenderChargeParams} from "./model/CreateSplitTenderChargeParams";
import {CreateTransactionParams} from "lightrail-client/dist/params";

interface StripeParams {
    currency: string;
    amount: number;
    source?: string;
    customer?: string;
    metadata?: object;
}

export async function createSplitTenderCharge(params: CreateSplitTenderChargeParams, lightrailShare: number, stripeObject: any): Promise<StripeLightrailSplitTenderCharge> {
    if (!params) {
        throw new Error("params not set");
    } else if (!params.userSuppliedId) {
        throw new Error("params.userSuppliedId not set");
    }
    //

    let splitTenderCharge: StripeLightrailSplitTenderCharge = {
        lightrailTransaction: null,
        stripeCharge: null
    };
    const stripeShare = params.amount - lightrailShare;
    let stripeParameters: StripeParams = {
        amount: stripeShare,
        currency: params.currency
    };
    if (params.source) {
        stripeParameters.source = params.source
    } else if (params.customer) {
        stripeParameters.customer = params.customer
    }

    if (lightrailShare > 0) {
        const contact = await lightrail.contacts.getContactByUserSuppliedId(params.shopperId);
        const card = await lightrail.cards.getAccountCardByContactAndCurrency(contact, params.currency);
        if (!card) {
            throw "No " + params.currency + " card found for shpperId '" + params.shopperId +"'.";
        }
        let lightrailTransactionParameters: CreateTransactionParams = {
            value: 0 - lightrailShare,
            currency: params.currency,
            pending: (stripeShare > 0),
            userSuppliedId: params.userSuppliedId,
            //todo:
        };
        const lightrailPendingTransaction =
            await lightrail.cards.transactions.createTransaction(card, lightrailTransactionParameters);
        splitTenderCharge.lightrailTransaction = lightrailPendingTransaction;

        if (stripeShare) {
            try {
                splitTenderCharge.stripeCharge = await stripeObject.charges.create(stripeParameters, {idempotency_key: params.userSuppliedId});
                splitTenderCharge.lightrailTransaction = await lightrail.cards.transactions.capturePending(card,
                    lightrailPendingTransaction,
                    {userSuppliedId: params.userSuppliedId + "-capture"});
            } catch (error) {
                splitTenderCharge.lightrailTransaction = await lightrail.cards.transactions.voidPending(card,
                    lightrailPendingTransaction,
                    {userSuppliedId: params.userSuppliedId + "-void"});
            }
        }
    } else {
        splitTenderCharge.stripeCharge = await stripeObject.charges.create(stripeParameters, {idempotency_key: params.userSuppliedId});
    }

    return splitTenderCharge;
}