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

export async function queryOpenSearch({ index, must, filter, should }) {
  const response = await osclient.search({
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

  if (!productObjects || !productObjects?.length) {
    return null;
  }

  // 2. Format as JSON array for Claude
  const context = JSON.stringify(productObjects, null, 2);

  //console.log(context, "CXT");

  return context;
}

export async function checkDeleteOpenSearch({ index, filter }) {
  const response = await osclient.search({
    index,
    body: {
      query: {
        bool: {
          filter,
        },
      },
    },
  });

  if (response.body.hits.total.value > 0) {
    const deleteResult = await osclient.deleteByQuery({
      index,
      body: {
        query: {
          bool: {
            filter,
          },
        },
      },
    });

    console.log("OS Doc Deleted:", deleteResult?.body?.deleted);
  } else {
    console.log("No documents found to delete.", response.body);
  }
}
