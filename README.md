# Place - A Reddit Place Clone

I got the inspiration from these two projects, both of which I highly recommend you check out:
- https://github.com/dynastic/place - A cleaner and leaner Node Place project
- https://github.com/xSke/Pxls - A server written in Java with a highly vibrant community

This branch is a rewrite of the backend in Go.

There is a seperate instance of this running on https://testing.killtheidols.com

Installation instructions:
## Prerequisites
- Go 1.8.3+
- Godep (https://github.com/tools/godep)
- MongoDB Server

## 1 - Clone it inside your GOPATH/GOROOT
```console
$ git clone https://github.com/liamcottam/place
```
## 2 - Install Go/Node.js dependencies
```console
$ dep ensure && npm i
```
## 3 - Build it
```console
$ npm run build:all
```
## 4 - Run it
```console
$ ./main
```