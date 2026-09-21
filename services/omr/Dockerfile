# Perfect Pitch — sheet recognition service.
#
# Audiveris on a JRE, with Node 22 to front it. This is a container service
# and not a serverless function: Audiveris is a Java desktop program that
# takes seconds to start and hundreds of megabytes to run, neither of which
# fits a function's budget. Deploy it to anything that runs a container and
# give it a URL; the site learns that URL through VITE_OMR_API_URL.
#
# Audiveris is licensed under the GNU Affero General Public License v3.0.
# Running this image for others to use is distributing Audiveris; see
# README.md for what that asks of you.

FROM eclipse-temurin:21-jre-jammy

ARG AUDIVERIS_VERSION=5.4
ARG NODE_MAJOR=22

ENV DEBIAN_FRONTEND=noninteractive

# Audiveris ships a .deb for Ubuntu 22.04, which this base image is. Tesseract
# language data is what its text recognition reads lyrics and titles with.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg tesseract-ocr-eng \
 && curl -fsSL "https://github.com/Audiveris/audiveris/releases/download/${AUDIVERIS_VERSION}/Audiveris-${AUDIVERIS_VERSION}-ubuntu22.04-x86_64.deb" -o /tmp/audiveris.deb \
 && apt-get install -y --no-install-recommends /tmp/audiveris.deb \
 && rm /tmp/audiveris.deb \
 && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get purge -y gnupg \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY src ./src

# Everything a request touches lives under /tmp and is removed after it.
# Nothing else in the container is written to.
RUN useradd --system --create-home --shell /usr/sbin/nologin omr
USER omr

ENV PORT=8080 \
    SHEET_MUSIC_ENABLED=false \
    AUDIVERIS_BIN=/opt/audiveris/bin/Audiveris \
    ALLOWED_ORIGIN=https://pitch-perfect-ashen.vercel.app \
    RECOGNIZE_TIMEOUT_MS=90000 \
    JAVA_TOOL_OPTIONS="-Xmx1g -Djava.awt.headless=true"

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["node", "src/server.mjs"]
