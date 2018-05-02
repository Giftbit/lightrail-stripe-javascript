import * as lightrail from "lightrail-client";
import {StripeLightrailSplitTenderCharge, CreateSplitTenderChargeParams, SimulateSplitTenderChargeParams} from "./params";
import {Transaction} from "lightrail-client/dist/model";
import {CreateTransactionParams, SimulateTransactionParams} from "lightrail-client/dist/params";

interface StripeParams {
    currency: string;
    amount: number;
    source?: string;
    customer?: string;
    destination?: object;
    metadata?: { [propertyName: string]: any; };
}

export async function simulateSplitTenderCharge(params: SimulateSplitTenderChargeParams, lightrailShare: number): Promise<StripeLightrailSplitTenderCharge> {
    if (!params) {
        throw new Error("params not set");
    } else if (!params.userSuppliedId) {
        throw new Error("params.userSuppliedId not set");
    } else if (params.amount <= 0) {
        throw new Error("params.amount must be > 0");
    } else if (lightrailShare < 0) {
        throw new Error("lightrailShare must be >= 0");
    } else if (lightrailShare > params.amount) {
        throw new Error("lightrailShare must <= params.amount");
    }

    let splitTenderSimulation: StripeLightrailSplitTenderCharge = {
        lightrailTransaction: null,
        stripeCharge: null
    };

    if (lightrailShare > 0) {
        const contact = await lightrail.contacts.getContactByUserSuppliedId(params.shopperId);
        const card = await lightrail.cards.getAccountCardByContactAndCurrency(contact, params.currency);
        if (!card) {
            throw new Error(`No ${params.currency} card found for shopperId '${params.shopperId}'.`);
        }
        let lightrailTransactionParameters: SimulateTransactionParams = {
            value: 0 - lightrailShare,
            currency: params.currency,
            userSuppliedId: params.userSuppliedId,
            nsf: params.nsf,
        };
        lightrailTransactionParameters.metadata = appendSplitTenderMetadataForLightrail(params, null);

        splitTenderSimulation.lightrailTransaction = await lightrail.cards.transactions.simulateTransaction(card, lightrailTransactionParameters);
    }

    return splitTenderSimulation;
}
export async function createSplitTenderCharge(params: CreateSplitTenderChargeParams, lightrailShare: number, stripeParam: object | string): Promise<StripeLightrailSplitTenderCharge> {
    if (!params) {
        throw new Error("params not set");
    } else if (!params.userSuppliedId) {
        throw new Error("params.userSuppliedId not set");
    } else if (params.amount <= 0) {
        throw new Error("params.amount must be > 0");
    } else if (lightrailShare < 0) {
        throw new Error("lightrailShare must be >= 0");
    } else if (lightrailShare > params.amount) {
        throw new Error("lightrailShare must <= params.amount");
    }

    const stripeObject = getStripeObject(stripeParam);

    let splitTenderCharge: StripeLightrailSplitTenderCharge = {
        lightrailTransaction: null,
        stripeCharge: null
    };
    const stripeShare = params.amount - lightrailShare;

    if (lightrailShare > 0) {
        const contact = await lightrail.contacts.getContactByUserSuppliedId(params.shopperId);
        const card = await lightrail.cards.getAccountCardByContactAndCurrency(contact, params.currency);
        if (!card) {
            throw new Error(`No ${params.currency} card found for shopperId '${params.shopperId}'.`);
        }
        let lightrailTransactionParameters: CreateTransactionParams = {
            value: 0 - lightrailShare,
            currency: params.currency,
            pending: (stripeShare > 0),
            userSuppliedId: params.userSuppliedId,
        };
        lightrailTransactionParameters.metadata = appendSplitTenderMetadataForLightrail(params, null);

        const lightrailPendingTransaction =
            await lightrail.cards.transactions.createTransaction(card, lightrailTransactionParameters);
        splitTenderCharge.lightrailTransaction = lightrailPendingTransaction;

        if (stripeShare) {
            try {
                let stripeParameters: StripeParams = splitTenderParamsToStripeParams(params, stripeShare, lightrailPendingTransaction);
                splitTenderCharge.stripeCharge = await stripeObject.charges.create(stripeParameters, {idempotency_key: params.userSuppliedId});
                splitTenderCharge.lightrailTransaction = await lightrail.cards.transactions.capturePending(
                    card,
                    lightrailPendingTransaction,
                    {
                        userSuppliedId: params.userSuppliedId + "-capture",
                        metadata: appendSplitTenderMetadataForLightrail(params, splitTenderCharge.stripeCharge),
                    });
            } catch (error) {
                splitTenderCharge.lightrailTransaction = await lightrail.cards.transactions.voidPending(
                    card,
                    lightrailPendingTransaction,
                    {
                        userSuppliedId: params.userSuppliedId + "-void",
                        metadata: appendSplitTenderMetadataForLightrail(params, splitTenderCharge.stripeCharge),
                    });
                throw error;
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
        amount: stripeAmount,
        metadata: splitTenderParams.metadata || {},
        shopperId: undefined,
        userSuppliedId: undefined
    } as StripeParams;

    paramsForStripe.metadata._split_tender_total = splitTenderParams.amount;
    paramsForStripe.metadata._split_tender_partner = "LIGHTRAIL";
    paramsForStripe.metadata._split_tender_partner_transaction_id = (lightrailTransaction && lightrailTransaction.transactionId) || "";

    return paramsForStripe;
}

function appendSplitTenderMetadataForLightrail(splitTenderParams: CreateSplitTenderChargeParams, stripeTransaction: any): object {
    if (!splitTenderParams.metadata) {
        splitTenderParams.metadata = {};
    }
    splitTenderParams.metadata._split_tender_total = splitTenderParams.amount;
    splitTenderParams.metadata._split_tender_partner = "STRIPE";
    if (stripeTransaction) {
        splitTenderParams.metadata._split_tender_partner_transaction_id = stripeTransaction.id;
    }

    return splitTenderParams.metadata;
}

function getStripeObject(stripeParam: object | string) {
    if (!stripeParam) {
        throw new Error("stripeParam not set");
    } else if (typeof stripeParam === "object") {
        return stripeParam;
    } else if (typeof stripeParam === "string") {
        return require("stripe")(stripeParam);
    }
}
