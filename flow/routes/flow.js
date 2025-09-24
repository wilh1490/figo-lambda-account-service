//import { Router } from "express";
import {
  FlowEndpointException,
  decryptRequest,
  encryptResponse,
  isRequestSignatureValid,
} from "../helper/tools.js";
import { getNextScreenMain } from "../helper/flow/main/index.js";
import { getNextScreenViewReceipt } from "../helper/flow/view-receipt/index.js";
import { getNextScreenChat } from "../helper/flow/chat/index.js";
import { getNextScreenRentr } from "../helper/flow/rentr/index.js";
import { getNextScreenMoringa } from "../helper/flow/moringa/index.js";
import { getNextScreenChatMoringa } from "../helper/flow/chat/moringa.js";
import { getNextScreenFigo } from "../helper/flow/figo/index.js";
import { getSecrets } from "../secrets.js";

const { PASSPHRASE } = await getSecrets();

const PRIVATE_KEY = `
-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFJDBWBgkqhkiG9w0BBQ0wSTAxBgkqhkiG9w0BBQwwJAQQcBvMn/WzHilpINiz
u41D9gICCAAwDAYIKoZIhvcNAgkFADAUBggqhkiG9w0DBwQI8PfBUvmOw9QEggTI
/2w5vIlGbZTp1xhBKjo4TRFd6Wt+Bw4bjqCY/uiURCfVHWFKXR+XFRZvBqQ+cQne
armGawLDVwFigsp44ENYtTXCK2KtxRLhhoxho4PteQmuoELZmaca3J+KQhaICUqk
hoco6vQyIwVDFZRvyHM0EbqADYydQFJbxB7gpgZBBsfF/LEQ7SMOxw9qQ+SgFQg6
3Jl8xOB22v2PemDL+UoHo7Y0/z/xVhZUEjhLR3naQEz7EvZzBAKTnowo5h5l6+jf
oQSBINk9oBFoZH2iMDkZaOZwBhyXdHPOaiCIvjlFQqFW0dIkJdrfXdy5a4ykVfVf
oh+BW73Ts5QeZPQLSFp6u1JWTRQehKDbjzn2ir+5xHftEIEgRcHYlfFmz+mRhphQ
nDK6dqNtKjNLb0IiDWiU2clJeED25VfcyxQ86Aq2RinFpHHdXtCml4PY/ZDz+glV
IS5kgYAva8KZxlp5838IKDbHA9IrxkuhRAjn36eryvvGamdxhmJKG5s4l6m0aAco
h0K38PBjFHbYIMxycS0nxZvy3xgikARlpDwwPWyyJ7y3w7BbixE4QcLGhjUmjHcD
7SHLqxXpVD+c1V0oQVbdDaVNLyY7OiJ2YGGtE/3tGotj6atVdDl2tU+fN00HY1XL
NuaWu6YXZkUt1bXK5NZF567yT+cj4YX/ZszTyQhMjAXQTTvGHGwXvyLToabwiTJf
PmU/pFtZ6bA/rjyi1lLdVze7hmPcou+1KTeIKtSCT5glz1BJ4KSIYhlVENHxeroO
DErvdfP2S3AS0pwnGCCYMDvxZsyuIE/mYJCi/QtyWId6A4bxUZgu1iGd8BUZtRG9
b2soTpSTWl6H/W/CMsqm8GCRqDA+Vz67ian7rNabcrIcR6oi5+T8vvfIhklP1dPT
eb0I2P95j65EsfcLeu02JuBFZrHyKay6XM1gtt8GQEe8mX7jBUUIDnCR+kN39X3W
aAsAJ9N9wYc4wx19bNHtWJGbGrjio1N6G5nknkQXK08/UrC2Gtxj4TY8MkOZvwK9
NKaR7i8hQzugnLg7jRzMtxrUZfsEGXcyN0Ie0d9O3+CLuqvnf1CVC5CA9vSzdxyg
FPcdjiFVZkhpwfBBTExN5mUEeItmEr9SEixu3xhDzfkh9q/Fw/EXmaVppslF0iso
zGFcihM4JuAiotHX0wXX3G2+HO4YVF9YhwvrsPU8wOVptZWlQNA6KaasZ15IYzF5
hKyicYf9hx11YfTj9/qEjpq73DYbq7v94b+8KkS4Q6p+PjZkEspzxf+UbgiECNBE
PAT4sa61lTpt3G8LSH12iG4BMH8/s425zHpUYCZfYljOjxwSZ0b8Jx6Nl/mMklKh
VZYtXNw7XkDVv5Lu274rvA4xtzxvxtlExtYzEScJoUwMHi5TfW9lIVh+Cs9VdwA0
E/Ue3FHNSH3w7dFv/cuaSUA9WGZtPmIlPQqBEX1o7HkxOmYZvmjbhdo9FIMNcUxa
7t+fGKLFTxz0P0bCvUP7/Ho6y/p8jOhbYJe56Wc/957Xe1XSSlbLSMih6OJ3oOX9
mzxAuCd8sl4ome9hhJAtlk4aMVGd6wm0TdsPRp7fFPiaWKLSwLJKr4TJWxER3f+8
isawP+awdPJQf83YbsRSkeAkz+2+CtH0
-----END ENCRYPTED PRIVATE KEY-----`;

export default function registerFlowRoute(router) {
  router.post("/main", async (req, res) => {
    console.log(req.rawBody, req.body);
    if (!PRIVATE_KEY) {
      throw new Error(
        'Private key is empty. Please check your env variable "PRIVATE_KEY".'
      );
    }

    if (!isRequestSignatureValid(req)) {
      // Return status code 432 if request signature does not match.
      // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
      return res
        .status(432)
        .send({ error: "request signature does not match" });
    }

    let decryptedRequest = null;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error(err);
      if (err instanceof FlowEndpointException) {
        return res.status(err.statusCode).send();
      }
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    // TODO: Uncomment this block and add your flow token validation logic.
    // If the flow token becomes invalid, return HTTP code 427 to disable the flow and show the message in `error_msg` to the user
    // Refer to the docs for details https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes

    /*
  if (!isValidFlowToken(decryptedBody.flow_token)) {
    const error_response = {
      error_msg: `The message is no longer available`,
    };
    return res
      .status(427)
      .send(
        encryptResponse(error_response, aesKeyBuffer, initialVectorBuffer)
      );
  }
  */

    const screenResponse = await getNextScreenMain(decryptedBody);
    console.log("👉 Response to Encrypt:", new Date(), screenResponse);

    res
      .status(200)
      .send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  });

  router.post("/view-receipt", async (req, res) => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'Private key is empty. Please check your env variable "PRIVATE_KEY".'
      );
    }

    if (!isRequestSignatureValid(req)) {
      // Return status code 432 if request signature does not match.
      // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
      return res
        .status(432)
        .send({ error: "request signature does not match" });
    }

    let decryptedRequest = null;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error(err);
      if (err instanceof FlowEndpointException) {
        return res.status(err.statusCode).send();
      }
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    // TODO: Uncomment this block and add your flow token validation logic.
    // If the flow token becomes invalid, return HTTP code 427 to disable the flow and show the message in `error_msg` to the user
    // Refer to the docs for details https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes

    /*
  if (!isValidFlowToken(decryptedBody.flow_token)) {
    const error_response = {
      error_msg: `The message is no longer available`,
    };
    return res
      .status(427)
      .send(
        encryptResponse(error_response, aesKeyBuffer, initialVectorBuffer)
      );
  }
  */

    const screenResponse = await getNextScreenViewReceipt(decryptedBody);
    console.log("👉 Response to Encrypt:", new Date(), screenResponse);

    res
      .status(200)
      .send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  });

  router.post("/chat-support", async (req, res) => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'Private key is empty. Please check your env variable "PRIVATE_KEY".'
      );
    }

    if (!isRequestSignatureValid(req)) {
      // Return status code 432 if request signature does not match.
      // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
      return res
        .status(432)
        .send({ error: "request signature does not match" });
    }

    let decryptedRequest = null;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error(err);
      if (err instanceof FlowEndpointException) {
        return res.status(err.statusCode).send();
      }
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    // TODO: Uncomment this block and add your flow token validation logic.
    // If the flow token becomes invalid, return HTTP code 427 to disable the flow and show the message in `error_msg` to the user
    // Refer to the docs for details https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes

    /*
  if (!isValidFlowToken(decryptedBody.flow_token)) {
    const error_response = {
      error_msg: `The message is no longer available`,
    };
    return res
      .status(427)
      .send(
        encryptResponse(error_response, aesKeyBuffer, initialVectorBuffer)
      );
  }
  */

    const screenResponse = await getNextScreenChat(decryptedBody);
    console.log("👉 Response to Encrypt:", new Date(), screenResponse);

    res
      .status(200)
      .send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  });

  router.post("/moringa-chat-support", async (req, res) => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'Private key is empty. Please check your env variable "PRIVATE_KEY".'
      );
    }

    if (!isRequestSignatureValid(req)) {
      return res
        .status(432)
        .send({ error: "request signature does not match" });
    }

    let decryptedRequest = null;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error(err);
      if (err instanceof FlowEndpointException) {
        return res.status(err.statusCode).send();
      }
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    const screenResponse = await getNextScreenChatMoringa(decryptedBody);
    console.log("👉 Response to Encrypt:", new Date(), screenResponse);

    res
      .status(200)
      .send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  });

  router.post("/rentr", async (req, res) => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'Private key is empty. Please check your env variable "PRIVATE_KEY".'
      );
    }

    if (!isRequestSignatureValid(req, "rentr")) {
      // Return status code 432 if request signature does not match.
      // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
      return res
        .status(432)
        .send({ error: "request signature does not match" });
    }

    let decryptedRequest = null;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error(err);
      if (err instanceof FlowEndpointException) {
        return res.status(err.statusCode).send();
      }
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    // TODO: Uncomment this block and add your flow token validation logic.
    // If the flow token becomes invalid, return HTTP code 427 to disable the flow and show the message in `error_msg` to the user
    // Refer to the docs for details https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes

    /*
  if (!isValidFlowToken(decryptedBody.flow_token)) {
    const error_response = {
      error_msg: `The message is no longer available`,
    };
    return res
      .status(427)
      .send(
        encryptResponse(error_response, aesKeyBuffer, initialVectorBuffer)
      );
  }
  */

    const screenResponse = await getNextScreenRentr(decryptedBody);
    console.log("👉 Response to Encrypt Rentr:", new Date(), screenResponse);

    res
      .status(200)
      .send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  });

  router.post("/moringa", async (req, res) => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'Private key is empty. Please check your env variable "PRIVATE_KEY".'
      );
    }

    if (!isRequestSignatureValid(req, "moringa")) {
      // Return status code 432 if request signature does not match.
      // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
      return res
        .status(432)
        .send({ error: "request signature does not match" });
    }

    let decryptedRequest = null;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error(err);
      if (err instanceof FlowEndpointException) {
        return res.status(err.statusCode).send();
      }
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    const screenResponse = await getNextScreenMoringa(decryptedBody);
    console.log("👉 Response to Encrypt Moringa:", new Date(), screenResponse);

    res
      .status(200)
      .send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  });

  router.post("/figo", async (req, res) => {
    if (!PRIVATE_KEY) {
      throw new Error(
        'Private key is empty. Please check your env variable "PRIVATE_KEY".'
      );
    }

    if (!isRequestSignatureValid(req, "figo")) {
      // Return status code 432 if request signature does not match.
      // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
      return res
        .status(432)
        .send({ error: "request signature does not match" });
    }

    let decryptedRequest = null;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error(err);
      if (err instanceof FlowEndpointException) {
        return res.status(err.statusCode).send();
      }
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    const screenResponse = await getNextScreenFigo(decryptedBody);
    console.log("👉 Response to Encrypt Figo:", new Date(), screenResponse);

    res
      .status(200)
      .send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  });

  router.get("/ping", (req, res) => {
    res.status(200).send("Pong 🔔.");
  });
}
