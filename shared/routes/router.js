export function Router() {
  const routes = [];
  const middlewares = [];

  const add = (method, path, handler) => {
    routes.push({ method, path, handler });
  };

  const runMiddlewares = (req, res, handlers, done) => {
    let i = 0;
    const next = () => {
      if (i < handlers.length) {
        handlers[i++](req, res, next);
      } else {
        done();
      }
    };
    next();
  };

  const match = async (req) => {
    const { method, path } = req;

    const route = routes.find((r) => r.method === method && r.path === path);

    if (!route) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
    }

    return new Promise((resolve) => {
      const res = {
        status(code) {
          this._status = code;
          return this;
        },
        json(obj) {
          resolve({
            statusCode: this._status || 200,
            body: JSON.stringify(obj),
          });
        },
        send(text) {
          resolve({
            statusCode: this._status || 200,
            body: typeof text === "string" ? text : JSON.stringify(text),
          });
        },
        sendStatus(code) {
          resolve({
            statusCode: code,
            body: JSON.stringify({ message: String(code) }),
          });
        },
      };

      runMiddlewares(req, res, middlewares, () => {
        route.handler(req, res);
      });
    });
  };

  return {
    use(prefix, registerFn) {
      registerFn({
        post: (path, handler) => add("POST", prefix + path, handler),
        get: (path, handler) => add("GET", prefix + path, handler),
      });
    },
    post: (path, handler) => add("POST", path, handler),
    get: (path, handler) => add("GET", path, handler),
    handle: match,
  };
}
