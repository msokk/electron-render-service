# :no_entry: [DEPRECATED] 
This project is not actively developed anymore as there are better solutions out there that are headless.
I would suggest using https://github.com/alvarcarto/url-to-pdf-api


# electron-render-service

[![Greenkeeper badge](https://badges.greenkeeper.io/msokk/electron-render-service.svg)](https://greenkeeper.io/)
[![Build Status](https://travis-ci.org/msokk/electron-render-service.svg?branch=master)](https://travis-ci.org/msokk/electron-render-service)
[![](https://images.microbadger.com/badges/image/msokk/electron-render-service.svg)](http://microbadger.com/images/msokk/electron-render-service "Get your own image badge on microbadger.com")
[![Docker Hub](https://img.shields.io/badge/docker-ready-blue.svg)](https://hub.docker.com/r/msokk/electron-render-service/)
[![npm](https://img.shields.io/npm/v/electron-render-service.svg)](https://www.npmjs.com/package/electron-render-service)

Simple PDF/PNG/JPEG render service, accepts webpage URL and returns the resource.

Alternatively an HTML payload can be POST-ed.

## Docker usage

Based on official [Debian Jessie](https://hub.docker.com/_/debian/) image, uses latest [electron](https://github.com/atom/electron).


1. `docker run -t -e RENDERER_ACCESS_KEY=secret -p 3000:3000 msokk/electron-render-service`
2. `wget -O out.pdf 'http://<node_address>:3000/pdf?accessKey=secret&url=https%3A%2F%2Fgithub.com%2Fmsokk%2Felectron-render-service'`

> NB: Set bigger shared memory size `--shm-size=Xm` (default: `64m`) if dealing with very heavy pages.

> Docker Swarm needs extra configuration to work - [`--shm-size` is not implemented](https://github.com/moby/moby/issues/26714) use `--mount type=tmpfs,dst=/dev/shm,tmpfs-size=134217728 ` instead and blank hostname `-e HOSTNAME=`.


## Installation on Debian with Node.js

```sh
# Enable contrib packages
sed -i 's/main/main contrib/g' /etc/apt/sources.list

# Install packages needed for runtime
apt-get update && apt-get install -y xvfb libgtk2.0-0 ttf-mscorefonts-installer libnotify4 libgconf2-4 libxss1 libnss3 dbus-x11

# Install from NPM
npm install -g electron-render-service

# Run in virtual framebuffer
RENDERER_ACCESS_KEY=secret xvfb-run --server-args="-screen 0 1024x768x24" electron-render-service

wget -O out.pdf 'http://localhost:3000/pdf?accessKey=secret&url=https%3A%2F%2Fgithub.com%2Fmsokk%2Felectron-render-service'
```


## Endpoints

#### `GET /pdf` - Render PDF

*Query params ([About PDF params](https://github.com/electron/electron/blob/master/docs/api/web-contents.md#contentsprinttopdfoptions-callback)):*

  * `accessKey` - Authentication key.
  * `url` - Full URL to fetch.
  * `pageSize` - Specify page size of the generated PDF. Can be `A3`, `A4`, `A5`, `Legal`, `Letter`, `Tabloid` or `<width>x<height>` in microns (e.g. `210000x297000` for A4)(default: `A4`)
  * `marginsType` - Specify the type of margins to use (default: `0`)
  * `printBackground` - Whether to print CSS backgrounds. (default: `true`)
  * `landscape` -  `true` for landscape, `false` for portrait. (default: `false`)
  * `removePrintMedia` - Removes any `<link media="print">` stylesheets on page before render. (default: `false`)
  * `delay` - Specify how many seconds to wait before generating the PDF (default: `0`)
  * `waitForText` - Specify a specific string of text to find before generating the PDF (default: `false`)

### `POST /pdf`

Identical as above, omit `url` and provide HTML in request body.

#### `GET /png|jpeg` - Render PNG/JPEG

*Query params:*

  * `accessKey` - Authentication key.
  * `url` - Full URL to fetch.
  * `quality` - JPEG quality. (default: `80`)
  * `delay` - Specify how many seconds to wait before generating the image (default: `0`)
  * `waitForText` - Specify a specific string of text to find before generating the image (default: `false`)
  * `browserWidth` - Browser window width (default: `rect.width || env.WINDOW_WIDTH`, max: `3000`)
  * `browserHeight` - Browser window height (default: `rect.height || env.WINDOW_HEIGHT`, max: `3000`)
  * Clipping rectangle (optional, but all four fields must be defined)
    * `clippingRect[x]`
    * `clippingRect[y]`
    * `clippingRect[width]`
    * `clippingRect[height]`

### `POST /png|jpeg`

Identical as above, omit `url` and provide HTML in request body.

#### `GET /stats` - Display render pool stats

*Query params:*

* `accessKey` - Generic authentication key is required.


## Environment variables

##### *Required*
* `RENDERER_ACCESS_KEY` or `RENDERER_ACCESS_KEY_<suffix>` - Secret key for limiting access. Suffixed keys are used as labels in access log for debugging usage.

##### *Optional*
* `CONCURRENCY` - Number of browser windows to run in parallel (default: `1`)
* `TIMEOUT` - Number of seconds before request timeouts (default: `30`)
* `WINDOW_WIDTH` - Default window width (default: `1024`)
* `WINDOW_HEIGHT` - Default window height (default: `768`)
* `HOSTNAME` - Hostname to accept Express connections on (default: `0.0.0.0`)
* `PORT` - (default: `3000`)
* `CHROMIUM_CLI_SWITCHES` - Comma separated list of Chromium command line switches to append. For example pass `ignore-certificate-errors` as value to render self-signed pages (at your own risk).


## Delayed Rendering

Not all content is loaded once the DOM is loaded, some data can take time because calls are being made via websockets and other methods. You can delay the rendering by either providing a `delay` value in the query string or you can provide `waitForText` in the query string.

If you specify `waitForText` the service will continually scan the loaded URL until the overall timeout is reached. If the text passed to the variable `waitForText` is found before the timeout, the PDF/image will generate and return.
