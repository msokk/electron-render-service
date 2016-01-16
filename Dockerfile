FROM node:slim

ENV RENDERER_ACCESS_KEY=changeme CONCURRENCY=1

# Add subpixel hinting
COPY .fonts.conf /root

COPY . /app
WORKDIR /app

# Install the packages needed to run Electron
RUN npm install --production && \
    sed -i 's/main/main contrib/g' /etc/apt/sources.list && \
    apt-get update && apt-get install -y xvfb \
      libgtk2.0-0 ttf-mscorefonts-installer libnotify4 libgconf2-4 libnss3 && \
    apt-get clean

EXPOSE 3000
CMD xvfb-run --server-args="-screen 0 800x600x24" npm start
