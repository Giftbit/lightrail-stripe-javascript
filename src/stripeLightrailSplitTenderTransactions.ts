import * as lightrail from "lightrail-client";

import {StripeLightrailSplitTenderCharge} from "./model/StripeLightrailSplitTenderCharge";
import {CreateSplitTenderChargeParams} from "./model/CreateSplitTenderChargeParams";
import {CreateTransactionParams} from "lightrail-client/dist/params";
import {Transaction} from "lightrail-client/dist/model";

interface StripeParams {
    currency: string;
    amount: number;
    source?: string;
    customer?: string;
    destination?: object;
    metadata?: { [propertyName: string]: any; };
}

export async function createSplitTenderChargeWithStripeKey(params: CreateSplitTenderChargeParams, lightrailShare: number, stripeSecretKey: string): Promise<StripeLightrailSplitTenderCharge> {
    const stripeObject = require("stripe")(stripeSecretKey);
    return createSplitTenderCharge(params, lightrailShare, stripeObject);
}

export async function createSplitTenderCharge(params: CreateSplitTenderChargeParams, lightrailShare: number, stripeObject: any): Promise<StripeLightrailSplitTenderCharge> {
    if (!params) {
        throw new Error("params not set");
    } else if (!params.userSuppliedId) {
        throw new Error("params.userSuppliedId not set");
    }

    let splitTenderCharge: StripeLightrailSplitTenderCharge = {
        lightrailTransaction: null,
        stripeCharge: null
    };
    const stripeShare = params.amount - lightrailShare;

    if (lightrailShare > 0) {
        const contact = await lightrail.contacts.getContactByUserSuppliedId(params.shopperId);
        const card = await lightrail.cards.getAccountCardByContactAndCurrency(contact, params.currency);
        if (!card) {
            throw "No " + params.currency + " card found for shpperId '" + params.shopperId + "'.";
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
                let stripeParameters: StripeParams = splitTenderParamsToStripeParams(params, stripeShare, lightrailPendingTransaction);
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
        let stripeParameters: StripeParams = splitTenderParamsToStripeParams(params, stripeShare, null);
        splitTenderCharge.stripeCharge = await stripeObject.charges.create(stripeParameters, {idempotency_key: params.userSuppliedId});
    }

    return splitTenderCharge;
}


// Helpers

function splitTenderParamsToStripeParams(splitTenderParams: CreateSplitTenderChargeParams, stripeAmount: number, lightrailTransaction: Transaction): StripeParams {
    let paramsForStripe = {
        ...splitTenderParams,
        metadata: splitTenderParams.metadata || {},
        shopperId: undefined,
        userSuppliedId: undefined
    } as StripeParams;

    paramsForStripe.metadata._split_tender_total = paramsForStripe.amount;
    paramsForStripe.metadata._split_tender_partner = 'LIGHTRAIL';
    paramsForStripe.metadata._split_tender_partner_transaction_id = '';
    if (lightrailTransaction && lightrailTransaction.transactionId) {
        paramsForStripe.metadata._split_tender_partner_transaction_id = lightrailTransaction.transactionId;
    }

    paramsForStripe.amount = stripeAmount;

    return paramsForStripe;
}
