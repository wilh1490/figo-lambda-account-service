import { Client as OSClient } from "@opensearch-project/opensearch";

const osclient = new OSClient({
  node: "https://search-figo-csbha53skwrkhtun42fmr42tui.us-east-1.es.amazonaws.com",
  auth: {
    username: "dpf",
    password: "Passion125#",
  },
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function QueryOpenSearch({ index, must, filter, should, size }) {
  const response = await osclient.search({
    size: size || 5,
    index, //product
    body: {
      query: {
        bool: {
          must, //[{ match: { text: userQuery } }]
          filter, //[{ term: { businessId: sessionId } }]
          should,
        },
      },
    },
  });

  const hits = response.body.hits.hits;

  // 1. Parse each document's text into an object
  const productObjects = hits
    .map((hit) => hit?._source?.text)
    .filter(Boolean)
    .map((text) => {
      try {
        const parsed = JSON.parse(text);
        return parsed; // return just the product object
      } catch (err) {
        console.warn("Failed to parse OpenSearch text field:", err);
        return null;
      }
    })
    .filter(Boolean); // remove nulls

  return productObjects;
}

export async function DeleteOpenSearch({ index, filter }) {
  const response = await osclient.deleteByQuery({
    index, //product
    body: {
      query: {
        bool: {
          filter, //[{ term: { businessId: sessionId } }]
        },
      },
    },
  });
  console.log("Delete account data:", response?.body?.deleted);

  return true;
}
