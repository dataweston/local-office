export class HttpException extends Error {}
export class BadRequestException extends HttpException {}
export class NotFoundException extends HttpException {}

export function Injectable(): ClassDecorator {
  return () => undefined;
}
