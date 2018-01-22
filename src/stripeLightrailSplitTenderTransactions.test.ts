import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as lightrail from "lightrail-client";
import {v4 as uuid} from "uuid";

import * as lightrailSplitTender from "./stripeLightrailSplitTenderTransactions";
import {CreateTransactionParams} from "lightrail-client/dist/params";
import {Card, Contact} from "lightrail-client/dist/model";
import {CreateSplitTenderChargeParams} from "./params/CreateSplitTenderChargeParams";
import {SimulateSplitTenderChargeParams} from "./params/SimulateSplitTenderChargeParams";

chai.use(chaiAsPromised);

const stripeAPIKey = process.env.STRIPE_SECRET_KEY;
const lightrailAPIKey = process.env.LIGHTRAIL_API_KEY;
const lightrailShopperId = process.env.LIGHTRAIL_SHOPPER_ID;
const stripeTestToken = "tok_visa";

const stripe = require("stripe")(
    stripeAPIKey
);

const splitTenderChargeParams: CreateSplitTenderChargeParams = {
    userSuppliedId: "",  //uuid must be generated in each test that uses this to avoid conflicts
    currency: "USD",
    amount: 1000,
    shopperId: lightrailShopperId,
    source: stripeTestToken
};

const splitTenderChargeParamsWithMetadata: CreateSplitTenderChargeParams = {
    userSuppliedId: "",  //uuid must be generated in each test that uses this to avoid conflicts
    currency: "USD",
    amount: 1000,
    shopperId: lightrailShopperId,
    source: stripeTestToken,
    metadata: {destination: "test"},
};

const lightrailOnlyParams: CreateSplitTenderChargeParams = {
    userSuppliedId: uuid(),
    currency: "USD",
    amount: 450,
    shopperId: lightrailShopperId,
};

const stripeOnlyParams: CreateSplitTenderChargeParams = {
    userSuppliedId: uuid(),
    currency: "USD",
    amount: 1200,
    source: stripeTestToken
};

const simulateSplitTenderChargeParams: SimulateSplitTenderChargeParams = {
    userSuppliedId: "",  //uuid must be generated in each test that uses this to avoid conflicts
    currency: "USD",
    amount: 1000,
    shopperId: lightrailShopperId,
};

const lightrailShare = 450;
const lightrailShareForNSF = 10000000;

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
        describe("using Stripe object", () => {
            it("posts a charge to Lightrail and Stripe", async () => {
                splitTenderChargeParams.userSuppliedId = uuid();
                const res = await lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParams, lightrailShare, stripe);
                chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                chai.assert.equal(res.lightrailTransaction.userSuppliedId, splitTenderChargeParams.userSuppliedId + "-capture");
            });

            it("appends split tender details to metadata without overwriting it", async () => {
                splitTenderChargeParamsWithMetadata.userSuppliedId = uuid();
                const res = await lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParamsWithMetadata, lightrailShare, stripe);
                chai.assert.equal(res.lightrailTransaction.metadata._split_tender_partner_transaction_id, res.stripeCharge.id);
                chai.assert.include(res.stripeCharge.metadata, {destination: "test"});
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

        describe("using Stripe secret key", () => {
            it("posts a charge to Lightrail and Stripe", async () => {
                splitTenderChargeParams.userSuppliedId = uuid();
                const res = await lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParams, lightrailShare, stripeAPIKey);
                chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                chai.assert.equal(res.lightrailTransaction.userSuppliedId, splitTenderChargeParams.userSuppliedId + "-capture");
            });

            it("appends split tender details to metadata without overwriting it", async () => {
                splitTenderChargeParamsWithMetadata.userSuppliedId = uuid();
                const res = await lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParamsWithMetadata, lightrailShare, stripeAPIKey);
                chai.assert.equal(res.lightrailTransaction.metadata._split_tender_partner_transaction_id, res.stripeCharge.id);
                chai.assert.include(res.stripeCharge.metadata, {destination: "test"});
            });

            it("posts a charge to Lightrail only", async () => {
                const res = await lightrailSplitTender.createSplitTenderCharge(lightrailOnlyParams, lightrailShare, stripeAPIKey);
                chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                chai.assert.equal(res.lightrailTransaction.userSuppliedId, lightrailOnlyParams.userSuppliedId);
            });

            it("posts a charge to Stripe only", async () => {
                const res = await lightrailSplitTender.createSplitTenderCharge(stripeOnlyParams, 0, stripeAPIKey);
                chai.assert.equal(res.stripeCharge.amount, stripeOnlyParams.amount);
            });

        });

        describe("error handling", () => {
            it("re-throws a Stripe error (bad Stripe object)", async () => {
                const badStripe = require("stripe")("abc");
                splitTenderChargeParams.userSuppliedId = uuid();
                chai.assert.isRejected(lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParams, 1, badStripe));
            });

            it("re-throws a Stripe error (bad Stripe API key)", async () => {
                const badStripeKey = "abc";
                splitTenderChargeParams.userSuppliedId = uuid();
                chai.assert.isRejected(lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParams, 1, badStripeKey));
            });

            it("re-throws a Lightrail error (pending phase)", async () => {
                const badParams = {
                    userSuppliedId: uuid(),
                    currency: "USD",
                    amount: 1000,
                    shopperId: "bad-shopper",
                    source: stripeTestToken
                };
                chai.assert.isRejected(lightrailSplitTender.createSplitTenderCharge(badParams, 1, stripe));
            });

            // it("re-throws a Lightrail error (capture phase)");         // requires stubbing a method: implement when tests are set up for this

            it("throws an error when Lightrail share set to more than total transaction amount", async () => {
                const badParams = {
                    userSuppliedId: uuid(),
                    currency: "USD",
                    amount: 50,
                    shopperId: lightrailShopperId,
                    source: stripeTestToken
                };
                chai.assert.isRejected(lightrailSplitTender.createSplitTenderCharge(badParams, 51, stripe), "Lightrail share greater than total transaction amount.");
            });
        });

    });

    describe("simulateSplitTenderCharge()", () => {
        describe("using Stripe object", () => {
            it("simulates posting a charge to Lightrail", async () => {
                simulateSplitTenderChargeParams.userSuppliedId = uuid();
                const res = await lightrailSplitTender.simulateSplitTenderCharge(simulateSplitTenderChargeParams, lightrailShare);
                chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                chai.assert.equal(res.lightrailTransaction.userSuppliedId, simulateSplitTenderChargeParams.userSuppliedId);
            });

            it("simulates posting a charge to Lightrail: nsf false", async () => {
                simulateSplitTenderChargeParams.userSuppliedId = uuid();
                simulateSplitTenderChargeParams.nsf = false;
                simulateSplitTenderChargeParams.amount = lightrailShareForNSF;
                const res = await lightrailSplitTender.simulateSplitTenderCharge(simulateSplitTenderChargeParams, lightrailShareForNSF);
                chai.assert.exists(res.lightrailTransaction.value);
            });

            it("simulates posting a charge to Lightrail: nsf true (promise rejects if card can't cover charge)", async () => {
                simulateSplitTenderChargeParams.userSuppliedId = uuid();
                simulateSplitTenderChargeParams.nsf = true;
                simulateSplitTenderChargeParams.amount = lightrailShareForNSF;
                await chai.assert.isRejected(lightrailSplitTender.simulateSplitTenderCharge(simulateSplitTenderChargeParams, lightrailShareForNSF));
            });
        });
    });
});