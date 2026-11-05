# `@nestjs/storage`: `uploadToDisk()` fails under `NodeAdapter`

With `NodeAdapter` from `@nestjs/platform-node`, `uploadToDisk()` throws on every upload even though
`StorageModule` is imported:

```
StorageError: uploadToDisk(): no StorageModule in the application handling this request.
```

## Versions

| Package                    | Version |
| -------------------------- | ------- |
| `@nestjs/common`           | 12.3.3  |
| `@nestjs/core`             | 12.3.3  |
| `@nestjs/platform-node`    | 12.3.3  |
| `@nestjs/storage`          | 0.0.4   |
| `reflect-metadata`         | 0.2.2   |
| `rxjs`                     | 7.8.2   |
| `typescript`               | 7.0.2   |
| `tsx`                      | 4.23.15 |

Tested on Node v26.13.0 (macOS).

## Steps

```bash
npm install
npm run repro
```

`npm run repro` starts `src/main.ts`, posts `test.txt` with `curl -F file=@test.txt http://localhost:3000/upload`,
prints the result, and stops the server. (`npm start` runs the server alone.)

## Actual output

```
entry: src/main.ts
request: curl -F file=@test.txt http://localhost:3000/upload
status: 500
body:   {"statusCode":500,"message":"Internal server error"}
server error: StorageError: uploadToDisk(): no StorageModule in the application handling this request. Import StorageModule.forRoot() or forRootAsync(), or pass a StorageDisk instance as `disk`.
```

The response body is Nest's generic 500; the error itself is only in the server log, which the script prints.

## Expected output

The upload is stored on the `main` disk and the stored file is returned (`key` and `etag` vary):

```
status: 201
body:   {"fieldname":"file","originalname":"test.txt","encoding":"7bit","mimetype":"text/plain","key":"<uuid>","size":21,"contentType":"application/octet-stream","etag":"\"...\""}
```

## Cause

- `StorageModule.onModuleInit` registers `httpAdapter.getInstance()` (a `NodeRouter` here) in a server registry.
- `storageForRequest(req)` (`@nestjs/storage/dist/http/app-registry.util.js`) only looks at `req.app` (following
  `.parent`) and `req.server` (following its prototype chain).
- On `NodeAdapter`, `req.app` is a frozen stub, `NODE_APP`, with only a `get()` method
  (`@nestjs/platform-node/adapters/node-request.js`), not the registered `NodeRouter`, and `req.server` is `undefined`.
  So the lookup returns `undefined` and `uploadToDisk()` throws.

Checked at runtime on a real request: `req.app === adapter.getInstance()` is `false`, `req.app` is frozen with
own keys `["get"]`, `req.server` is `undefined`, and `storageForRequest(req)` is `undefined`, while
`storageForRequest({ app: adapter.getInstance() })` does return the `Storage`.

## Control: passing a `StorageDisk` instance works

```bash
npm run repro:workaround
```

`src/workaround.ts` is identical except `uploadToDisk({ disk: lazyDisk })` gets a `StorageDisk` proxy that
`AppModule.onModuleInit` binds to the real disk. A disk instance skips the per-request lookup, and the upload succeeds:

```
entry: src/workaround.ts
request: curl -F file=@test.txt http://localhost:3000/upload
status: 201
body:   {"fieldname":"file","originalname":"test.txt","encoding":"7bit","mimetype":"text/plain","key":"<uuid>","size":21,"contentType":"application/octet-stream","etag":"\"...\""}
```
