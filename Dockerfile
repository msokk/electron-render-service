FROM node:slim

MAINTAINER Mihkel Sokk <mihkelsokk@gmail.com>

ENV RENDERER_ACCESS_KEY=changeme CONCURRENCY=1 WINDOW_WIDTH=1024 WINDOW_HEIGHT=768 NODE_ENV=production

# Add subpixel hinting
COPY .fonts.conf /root/.fonts.conf

COPY . /app
WORKDIR /app

# Install the packages needed to run Electron
RUN npm install --production && \
    sed -i 's/main/main contrib/g' /etc/apt/sources.list && \
    apt-get update && apt-get upgrade -y && apt-get install -y xvfb \
      libgtk2.0-0 ttf-mscorefonts-installer libnotify4 libgconf2-4 libnss3 dbus-x11 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

CMD xvfb-run --server-args="-screen 0 ${WINDOW_WIDTH}x${WINDOW_HEIGHT}x24" npm start
