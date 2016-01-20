# electron-render-service
[![Docker Hub](https://img.shields.io/badge/docker-ready-blue.svg)](https://registry.hub.docker.com/u/msokk/electron-render-service/)
[![ImageLayers Size](https://img.shields.io/imagelayers/image-size/msokk/electron-render-service/latest.svg)]()
[![npm](https://img.shields.io/npm/v/electron-render-service.svg)](https://www.npmjs.com/package/electron-render-service)
[![Dependency Status](https://david-dm.org/msokk/electron-render-service.svg)](https://david-dm.org/msokk/electron-render-service)

Simple PDF/PNG/JPEG render service, accepts webpage URL and returns the resource.


## Docker usage

Based on official [Node.js Jessie](https://hub.docker.com/_/node/) image, uses latest [electron](https://github.com/atom/electron).


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
RENDERER_ACCESS_KEY=secret xvfb-run --server-args="-screen 0 1024x768x24" npm start

wget -o out.pdf http://localhost:3000/pdf?url=https://github.com/msokk/electron-render-service&access_key=secret
```


## Endpoints

#### `GET /pdf` - Render PDF

*Query params ([About PDF params](https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback)):*

  * `access_key` - Authentication key.
  * `url` - Full URL to fetch.
  * `pageSize` - Specify page size of the generated PDF. (default: `A4`)
  * `marginsType` - Specify the type of margins to use (default: `0`)
  * `printBackground` - Whether to print CSS backgrounds. (default: `true`)
  * `landscape` -  `true` for landscape, `false` for portrait. (default: `false`)

#### `GET /png|jpeg` - Render PNG/JPEG

*Query params:*

  * `access_key` - Authentication key.
  * `url` - Full URL to fetch.
  * `quality` - JPEG quality. (default: `80`)
  * `browserWidth` - Browser window width (default: `rect.width || env.WINDOW_WIDTH`, max: `3000`)
  * `browserHeight` - Browser window height (default: `rect.height || env.WINDOW_HEIGHT`, max: `3000`)
  * Clipping rectangle (optional, but all 4 integers need to be set)
    * `x`
    * `y`
    * `width`
    * `height`

#### `GET /stats` - Display render pool stats

*Query params:*

* `access_key` - Generic authentication key is required.


## Environment variables

##### *Required*
* `RENDERER_ACCESS_KEY` or `RENDERER_ACCESS_KEY_<suffix>` - Secret key for limiting access. Suffixed keys are used as labels in access log for debugging usage.

##### *Optional*
* `CONCURRENCY` - Number of browser windows to run in parallel (default: `1`)
* `TIMEOUT` - Number of seconds before request timeouts (default: `30`)
* `WINDOW_WIDTH` - Default window width (default: `1024`)
* `WINDOW_HEIGHT` - Default window height (default: `768`)
* `INTERFACE` - Network interface for Express to listen on (default: `0.0.0.0`)
* `PORT` - (default: `3000`)

## Rendering issues in latest Electron (Chrome 47)
* [box-shadow is black in PDF](https://code.google.com/p/chromium/issues/detail?id=174583) - To keep the box shadow, add `-webkit-filter: blur(0);` rule next to it. Note that this rasterizes the whole layer, making large areas noticeably blurry. Or just hide the box shadow.
* `border-radius` creates double width borders without rounded corners
