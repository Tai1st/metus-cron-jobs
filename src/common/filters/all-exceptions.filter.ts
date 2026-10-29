import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionFilter.name);

    catch(exception: any, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();
        const isHttp = exception instanceof HttpException;
        const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        // Không lộ chi tiết lỗi nội bộ cho client.
        const message = isHttp
            ? (exception.getResponse() as AnyObject)?.message || exception.message
            : 'Internal server error';

        this.logger.error(exception?.stack || exception?.message);
        response.status(status).json({ statusCode: status, message });
    }
}
