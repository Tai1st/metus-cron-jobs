import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Bọc kết quả theo dạng { data, statusCode, message } như các API còn lại của Metus. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, IResponse<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<IResponse<T>> {
        const statusCode = context.switchToHttp().getResponse().statusCode;
        return next.handle().pipe(map((data) => ({ data, statusCode, message: 'Success' })));
    }
}
