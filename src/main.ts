import 'reflect-metadata';
import { Controller, Module, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FileInterceptor, NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { LocalDisk, StorageModule, uploadToDisk } from '@nestjs/storage';

@Controller()
class UploadController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: uploadToDisk() }))
  upload(@UploadedFile() file: unknown) {
    return file;
  }
}

@Module({
  imports: [
    StorageModule.forRoot({
      default: 'main',
      disks: { main: new LocalDisk({ root: './uploads' }) },
    }),
  ],
  controllers: [UploadController],
})
class AppModule {}

const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter());
await app.listen(3000);
