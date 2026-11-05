// Control: identical to main.ts, except uploadToDisk() is given a StorageDisk instance
// (`disk: lazyDisk`), which skips the per-request StorageModule lookup that fails on NodeAdapter.
import 'reflect-metadata';
import {
  Controller,
  Inject,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
  type OnModuleInit,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FileInterceptor, NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { LocalDisk, Storage, StorageModule, uploadToDisk, type StorageDisk } from '@nestjs/storage';

// uploadToDisk() runs when the decorator is evaluated, before any module exists, so the real
// disk is not available yet. Pass a proxy and bind it to the configured disk in onModuleInit.
let bound: StorageDisk | undefined;
const lazyDisk = new Proxy({} as StorageDisk, {
  get(_target, prop) {
    if (!bound) throw new Error('lazyDisk used before AppModule.onModuleInit()');
    const value = Reflect.get(bound, prop, bound);
    return typeof value === 'function' ? value.bind(bound) : value;
  },
});

@Controller()
class UploadController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: uploadToDisk({ disk: lazyDisk }) }))
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
class AppModule implements OnModuleInit {
  constructor(@Inject(Storage) private readonly storage: Storage) {}

  onModuleInit() {
    bound = this.storage.disk();
  }
}

const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter());
await app.listen(3000);
