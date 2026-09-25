import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    let status = 500;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const payload = body as { message?: string | string[]; error?: string };
        message = payload.message ?? exception.message;
        error = payload.error ?? HttpStatus[status];
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        message = 'Resource already exists';
        error = 'Conflict';
      }
      if (exception.code === 'P2025') {
        status = 404;
        message = 'Resource not found';
        error = 'Not Found';
      }
      if (exception.code === 'P2003') {
        status = 400;
        message = 'Invalid related resource';
        error = 'Bad Request';
      }
    }
    if (status === 500)
      this.logger.error(
        'Unhandled request failure',
        exception instanceof Error ? exception.stack : undefined,
      );
    ctx.getResponse<Response>().status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().path,
    });
  }
}
