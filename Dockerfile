FROM node:slim

MAINTAINER Mihkel Sokk <mihkelsokk@gmail.com>

ENV RENDERER_ACCESS_KEY=changeme CONCURRENCY=1 WINDOW_WIDTH=1024 WINDOW_HEIGHT=768

# Add subpixel hinting
COPY .fonts.conf /root/.fonts.conf

COPY . /app
WORKDIR /app

# Install the packages needed to run Electron
RUN npm install --production && \
    sed -i 's/main/main contrib/g' /etc/apt/sources.list && \
    apt-get update && apt-get install -y xvfb \
      libgtk2.0-0 ttf-mscorefonts-installer libnotify4 libgconf2-4 libnss3 && \
    apt-get clean

EXPOSE 3000

CMD xvfb-run --server-args="-screen 0 $WINDOW_WIDTHx$WINDOW_HEIGHTx24" npm start
