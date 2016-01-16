# electron-render-service
[![Docker Hub](https://img.shields.io/badge/docker-ready-blue.svg)](https://registry.hub.docker.com/u/msokk/electron-render-service/)
[![](https://badge.imagelayers.io/msokk/electron-render-service:latest.svg)](https://imagelayers.io/?images=msokk/electron-render-service:latest 'Get your own badge on imagelayers.io')

Simple PDF render service, accepts webpage URL and returns it as a PDF.


## Docker usage

Based on official [Node.js Jessie](https://hub.docker.com/_/node/) image,
uses latest [electron](https://github.com/atom/electron).


1. `docker run -t -e RENDERER_ACCESS_KEY=secret -p 3000:3000 msokk/electron-render-service`
2. `wget -o out.pdf http://<node_address>:3000/pdf?url=https://github.com/msokk/electron-render-service&access_key=secret`


## Installation on Debian with Node.js

```sh
# Enable contrib packages
sed -i 's/main/main contrib/g' /etc/apt/sources.list

# Install packages needed for runtime
apt-get update && apt-get install -y xvfb libgtk2.0-0 ttf-mscorefonts-installer libnotify4 libgconf2-4 libnss3

# Clone project (not yet on NPM)
git clone https://github.com/msokk/electron-render-service.git
npm install

# Run in virtual framebuffer
RENDERER_ACCESS_KEY=secret xvfb-run --server-args="-screen 0 800x600x24" npm start

wget -o out.pdf http://localhost:3000/pdf?url=https://github.com/msokk/electron-render-service&access_key=secret
```

## Endpoints

#### `GET /pdf` - Render PDF

> Query params ([About PDF params](https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback)):

  * `access_key` - Authentication key.
  * `url` - Full URL to fetch.
  * `pageSize` - Specify page size of the generated PDF. (default: `A4`)
  * `marginsType` - Specify the type of margins to use (default: `0`)
  * `printBackground` - Whether to print CSS backgrounds. (default: `true`)
  * `landscape` -  `true` for landscape, `false` for portrait. (default: `false`)


#### `GET /stats` - Display render pool stats

> Query params:

* `access_key` - Generic authentication key is required.


## Environment variables

##### *Required*
* `RENDERER_ACCESS_KEY` or `RENDERER_ACCESS_KEY_<suffix>` - Secret key for limiting access. Suffixed keys are used as labels in access log for debugging usage.

##### *Optional*
* `CONCURRENCY` - Number of browser windows to run in parallel (default: `1`)
* `INTERFACE` - Network interface for Express to listen on (default: `0.0.0.0`)
* `PORT` - (default: `3000`)
