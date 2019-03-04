FROM buildpack-deps:jessie-curl

LABEL maintainer="Mihkel Sokk <mihkelsokk@gmail.com>"

ENV RENDERER_ACCESS_KEY=changeme \
    CONCURRENCY=1 \
    WINDOW_WIDTH=1024 \
    WINDOW_HEIGHT=768 \
    NODE_ENV=production \
    ELECTRON_ENABLE_STACK_DUMPING=true \
    ELECTRON_ENABLE_LOGGING=true \
    ELECTRON_DISABLE_SECURITY_WARNINGS=true

WORKDIR /app

# Add subpixel hinting
COPY .fonts.conf /root/.fonts.conf

# Install the packages needed to run Electron
RUN sed -i 's/main/main contrib/g' /etc/apt/sources.list
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
	unzip \
	xvfb \
	libgtk2.0-0 \
	ttf-mscorefonts-installer \
	libnotify4 \
	libgconf2-4 \
	libxss1 \
	libnss3 \
	dbus-x11 \
	&& rm -rf /var/lib/apt/lists/*

# As the inline fonts should not change much put them before the app
COPY fonts/* /usr/share/fonts/truetype/

# Install NodeJS
RUN curl -sSL http://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
RUN echo "deb http://deb.nodesource.com/node_10.x jessie main" > /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install -y \
	nodejs \
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -f /etc/apt/sources.list.d/nodesource.list

# Install dependencies
COPY package.json /app/package.json
RUN sed -i '/\"electron\"\:/d' ./package.json \
	&& npm install --production --no-optional

# Install Electron
# You can define a different Electron version on build using the `--build-args electron_version=x.y.z` argument
ARG electron_version=4.0.6
RUN wget "https://github.com/atom/electron/releases/download/v${electron_version}/electron-v${electron_version}-linux-x64.zip" -O electron.zip \
	&& unzip electron.zip \
	&& rm electron.zip

# Clean up
RUN apt-get remove -y unzip nodejs \
	&& apt-get clean

COPY . /app

EXPOSE 3000
CMD ["sh", "-c", "[ -e /tmp/.X99-lock ] && rm /tmp/.X99-lock; xvfb-run -e /dev/stdout --server-args=\"-screen 0 ${WINDOW_WIDTH}x${WINDOW_HEIGHT}x24\" ./electron --disable-gpu src/server.js"]
