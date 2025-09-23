export class CustomError extends Error {
  constructor(msg = "", code = "", ...params) {
    super(...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
    this.code = code;
    this.message = msg;
  }
}
