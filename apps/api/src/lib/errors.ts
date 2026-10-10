/** An error the client should see as-is: HTTP status plus a stable machine-readable code. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const unauthorized = (message = 'Потрібно увійти') =>
  new HttpError(401, 'unauthorized', message);
export const notFound = (what: string) => new HttpError(404, 'not_found', `Unknown ${what}`);
