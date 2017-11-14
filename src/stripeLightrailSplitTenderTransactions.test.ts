import * as chai from "chai";
import * as lightrail from "lightrail-client";
import {v4 as uuid} from "uuid";

import * as lightrailSplitTender from "./stripeLightrailSplitTenderTransactions";
import {CreateTransactionParams} from "lightrail-client/dist/params";
import {Card, Contact} from "lightrail-client/dist/model";

const stripeAPIKey = process.env.STRIPE_SECRET_KEY;
const lightrailAPIKey = process.env.LIGHTRAIL_API_KEY;
const lightrailShopperId = process.env.LIGHTRAIL_SHOPPER_ID;
const stripeTestToken = "tok_visa";
const metadata = {destination: 'test'};

const stripe = require("stripe")(
    stripeAPIKey
);

const splitTenderChargeParams = {
    userSuppliedId: '',  //uuid must be generated in each test that uses this to avoid conflicts
    currency: 'USD',
    amount: 1000,
    shopperId: lightrailShopperId,
    source: stripeTestToken
};

const splitTenderChargeParamsWithMetadata = {
    userSuppliedId: '',  //uuid must be generated in each test that uses this to avoid conflicts
    currency: 'USD',
    amount: 1000,
    shopperId: lightrailShopperId,
    source: stripeTestToken,
    metadata: Object.assign({}, metadata),
};

const lightrailOnlyParams = {
    userSuppliedId: uuid(),
    currency: 'USD',
    amount: 450,
    shopperId: lightrailShopperId,
};

const stripeOnlyParams = {
    userSuppliedId: uuid(),
    currency: 'USD',
    amount: 1200,
    source: stripeTestToken
};

const lightrailShare = 450;

describe("stripeLightrailSplitTenderTransactions", () => {
    before(() => {
        lightrail.configure({
            apiKey: lightrailAPIKey,
            restRoot: "https://api.lightrail.com/v1/"
        });
    });

    afterEach(() => {
        //return the funds back to the card so that we can redo the test
        const lightrailTransactionParameters: CreateTransactionParams = {
            value: lightrailShare,
            currency: splitTenderChargeParams.currency,
            userSuppliedId: uuid(),
        };
        lightrail.contacts.getContactByUserSuppliedId(splitTenderChargeParams.shopperId).then(
            (contact: Contact) => (lightrail.cards.getAccountCardByContactAndCurrency(contact, lightrailTransactionParameters.currency).then(
                (card: Card) => (lightrail.cards.transactions.createTransaction(card, lightrailTransactionParameters).then())
            ))
        );
    });

    describe("createSplitTenderCharge()", () => {
        it("posts a charge to Lightrail and Stripe", async () => {
            splitTenderChargeParams.userSuppliedId = uuid();
            const res = await lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParams, lightrailShare, stripe);
            chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
            chai.assert.equal(res.lightrailTransaction.userSuppliedId, splitTenderChargeParams.userSuppliedId + '-capture');
        });

        it("appends split tender details to metadata without overwriting it", async () => {
            splitTenderChargeParamsWithMetadata.userSuppliedId = uuid();
            const res = await lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParamsWithMetadata, lightrailShare, stripe);
            chai.assert.equal(res.lightrailTransaction.metadata._split_tender_partner_transaction_id, res.stripeCharge.id);
            chai.assert.include(res.stripeCharge.metadata, metadata);
        });

        it("posts a charge to Lightrail only", async () => {
            //todo: balance check the card and adjust the amount of the transaction to be less than that to make this test repeatable.
            const res = await lightrailSplitTender.createSplitTenderCharge(lightrailOnlyParams, lightrailShare, stripe);
            chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
            chai.assert.equal(res.lightrailTransaction.userSuppliedId, lightrailOnlyParams.userSuppliedId);
        });

        it("posts a charge to Stripe only", async () => {
            const res = await lightrailSplitTender.createSplitTenderCharge(stripeOnlyParams, 0, stripe);
            chai.assert.equal(res.stripeCharge.amount, stripeOnlyParams.amount);
        });
    });

    describe("createSplitTenderChargeWithStripeKey()", () => {
        it("posts a charge to Lightrail and Stripe", async () => {
            splitTenderChargeParams.userSuppliedId = uuid();
            const res = await lightrailSplitTender.createSplitTenderChargeWithStripeKey(splitTenderChargeParams, lightrailShare, stripeAPIKey);
            chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
            chai.assert.equal(res.lightrailTransaction.userSuppliedId, splitTenderChargeParams.userSuppliedId + '-capture');
            chai.assert.equal(res.lightrailTransaction.metadata._split_tender_partner_transaction_id, res.stripeCharge.id);
        });

        it("appends split tender details to metadata without overwriting it", async () => {
            splitTenderChargeParamsWithMetadata.userSuppliedId = uuid();
            const res = await lightrailSplitTender.createSplitTenderChargeWithStripeKey(splitTenderChargeParamsWithMetadata, lightrailShare, stripeAPIKey);
            chai.assert.equal(res.lightrailTransaction.metadata._split_tender_partner_transaction_id, res.stripeCharge.id);
            chai.assert.include(res.stripeCharge.metadata, metadata);
        });

        it("posts a charge to Lightrail only", async () => {
            const res = await lightrailSplitTender.createSplitTenderChargeWithStripeKey(lightrailOnlyParams, lightrailShare, stripeAPIKey);
            chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
            chai.assert.equal(res.lightrailTransaction.userSuppliedId, lightrailOnlyParams.userSuppliedId);
        });

        it("posts a charge to Stripe only", async () => {
            const res = await lightrailSplitTender.createSplitTenderChargeWithStripeKey(stripeOnlyParams, 0, stripeAPIKey);
            chai.assert.equal(res.stripeCharge.amount, stripeOnlyParams.amount);
        });
    });
});