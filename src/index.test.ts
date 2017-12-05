import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const stripeAPIKey = process.env.STRIPE_SECRET_KEY;
const lightrailAPIKey = process.env.LIGHTRAIL_API_KEY;
const lightrailShopperId = process.env.LIGHTRAIL_SHOPPER_ID;

const stripe = require("stripe")(
    stripeAPIKey
);

describe("set up test config", () => {
    it("has a Lightrail API key", () => {
        chai.assert.isString(lightrailAPIKey, "Lightrail API key must be a string: see readme to configure");
    });
    it("has a Stripe API key", () => {
        chai.assert.isString(stripeAPIKey, "Stripe API key must be a string: see readme to configure");
    });
    it("has a Lightrail shopper ID", () => {
        chai.assert.isString(lightrailShopperId, "Lightrail shopper ID must be a string: see readme to configure");
    });
});