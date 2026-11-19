export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const fail = (statusCode: number, message: string): never => {
  throw new HttpError(statusCode, message);
};
