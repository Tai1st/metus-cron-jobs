import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionFilter } from './common/filters/all-exceptions.filter';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);
    const logger = new Logger('Bootstrap');

    // API này chỉ được gọi server-to-server từ BE nên không mở CORS cho trình duyệt.
    app.useGlobalFilters(new AllExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    // Swagger chỉ bật ngoài production.
    if (config.get('APP_ENV') !== 'production') {
        const swaggerConfig = new DocumentBuilder()
            .setTitle(config.get('APP_NAME', 'Metus Cron Jobs'))
            .addBearerAuth(
                {
                    description: 'Bearer <JWT>',
                    name: 'Authorization',
                    bearerFormat: 'Bearer',
                    scheme: 'Bearer',
                    type: 'http',
                    in: 'Header',
                },
                'access-token',
            )
            .build();
        SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
    }

    const port = Number(config.get('APP_PORT', 8001));
    await app.listen(port);
    logger.log(`Server started from port: ${port}`);
}
bootstrap();
