FROM msokk/electron-render-service

MAINTAINER Andrew Shankie <andrew@properdesign.co.uk>

COPY ./src/ /app/src/

RUN mkdir /app/public