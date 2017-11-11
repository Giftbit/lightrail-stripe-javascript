import * as chai from "chai";
import * as lightrail from "lightrail-client";
import {v4 as uuid} from "uuid";


import * as lightrailSplitTender from "./stripeLightrailSplitTenderTransactions";
import {CreateTransactionParams} from "lightrail-client/dist/params";
import {Card, Contact} from "lightrail-client/dist/model";
//require('dotenv').config();

const stripeAPIKey= "";//process.env.STRIPE_SECRET_KEY
const lightrailAPIKey = ""; //process.env.LIGHTRAIL_API_KEY
const lightrailShopperId= "alice"; //process.env.LIGHTRAIL_SHOPPER_ID
const stripeTestToken= "tok_visa"; //process.env.STRIPE_TEST_TOKEN

const stripe = require("stripe")(
    stripeAPIKey
);

const splitTenderChargeParams = {
    userSuppliedId: uuid(),
    currency: 'USD',
    amount: 1000,
    shopperId: lightrailShopperId,
    source: stripeTestToken
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
        it("posts a charge to Lightrail and Stripe", (done) => {
            lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParams, lightrailShare, stripe)
                .then((res) => {
                    chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                    chai.assert.equal(res.lightrailTransaction.userSuppliedId, splitTenderChargeParams.userSuppliedId + '-capture');
                })
                .then(() => {
                    done();
                })
                .catch(done);
        });

        it("posts a charge to Lightrail only", (done) => {

            //todo: balance check the card and adjust the amount of the transaction to be less than that to make this test repeatable.
            lightrailSplitTender.createSplitTenderCharge(lightrailOnlyParams, lightrailShare, stripe)
                .then((res) => {
                    chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                    chai.assert.equal(res.lightrailTransaction.userSuppliedId, lightrailOnlyParams.userSuppliedId);
                })
                .then(() => {
                    done();
                })
                .catch(done);
        });

        it("posts a charge to Stripe only", (done) => {
            lightrailSplitTender.createSplitTenderCharge(stripeOnlyParams, 0, stripe)
                .then((res) => {
                    chai.assert.equal(res.stripeCharge.amount, stripeOnlyParams.amount);
                })
                .then(() => {
                    done();
                })
                .catch(done);
        });
    });

    describe("createSplitTenderChargeWithStripeKey()", () => {
        it("posts a charge to Lightrail and Stripe", (done) => {
            lightrailSplitTender.createSplitTenderChargeWithStripeKey(splitTenderChargeParams, lightrailShare, stripeAPIKey)
                .then((res) => {
                    chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                    chai.assert.equal(res.lightrailTransaction.userSuppliedId, splitTenderChargeParams.userSuppliedId + '-capture');
                })
                .then(() => {
                    done();
                })
                .catch(done);
        });

        it("posts a charge to Lightrail only", (done) => {

            lightrailSplitTender.createSplitTenderChargeWithStripeKey(lightrailOnlyParams, lightrailShare, stripeAPIKey)
                .then((res) => {
                    chai.assert.equal(res.lightrailTransaction.value, 0 - lightrailShare);
                    chai.assert.equal(res.lightrailTransaction.userSuppliedId, lightrailOnlyParams.userSuppliedId);
                })
                .then(() => {
                    done();
                })
                .catch(done);
        });

        it("posts a charge to Stripe only", (done) => {
            lightrailSplitTender.createSplitTenderChargeWithStripeKey(stripeOnlyParams, 0, stripeAPIKey)
                .then((res) => {
                    chai.assert.equal(res.stripeCharge.amount, stripeOnlyParams.amount);
                })
                .then(() => {
                    done();
                })
                .catch(done);
        });
    });
});