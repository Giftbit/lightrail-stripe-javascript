import * as chai from "chai";
import * as lightrail from "lightrail-client";
import {v4 as uuid} from 'uuid';


import * as lightrailSplitTender from "./stripeLightrailSplitTenderTransactions";
import {CreateTransactionParams} from "lightrail-client/dist/params";
import {Card, Contact} from "lightrail-client/dist/model";
//require('dotenv').config();

const splitTenderChargeParams = {
    userSuppliedId: '12345678910',
    currency: 'USD',
    amount: 1000,
    shopperId: 'alice',
    source: 'tok_visa'
};

const lightrailShare = 450;

describe("stripeLightrailSplitTenderTransactions", () => {
    before(() => {
        lightrail.configure({
            apiKey: "",
            // apiKey: process.env.LIGHTRAIL_API_KEY,
            restRoot: "https://api.lightrail.com/v1/"
        });
        // console.log(Stripe.apiKey);
    });

    after(() => {
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
            let stripe = require("stripe")(
                ""
            );
            lightrailSplitTender.createSplitTenderCharge(splitTenderChargeParams, lightrailShare, stripe)
                .then((res) => {
                    chai.assert.equal(res.lightrailTransaction.value, 0-lightrailShare);
                    console.log(res.lightrailTransaction);
                    console.log(res.stripeCharge);
                })
                .then(() => {
                    done();
                })
                .catch(done);
        });
    });
});