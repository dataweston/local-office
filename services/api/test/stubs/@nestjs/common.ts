export class HttpException extends Error {
  constructor(message?: string, public readonly status?: number) {
    super(message);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

export function Injectable(): ClassDecorator {
  return () => {};
}

export function Module(): ClassDecorator {
  return () => {};
}

export function Controller(): ClassDecorator {
  return () => {};
}

export function Get(): MethodDecorator {
  return () => {};
}

export function Post(): MethodDecorator {
  return () => {};
}

export function HttpCode(_status: number): MethodDecorator {
  return () => {};
}

export const HttpStatus = { ACCEPTED: 202 } as const;

export function Param(): ParameterDecorator {
  return () => {};
}

export function Inject(_token?: unknown): ParameterDecorator {
  return () => {};
}

export function OnModuleDestroy(): ClassDecorator {
  return () => {};
}
