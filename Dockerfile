FROM node:10.16.3-alpine

WORKDIR /usr/src/app

# node.js application for swaping and renewing HTTPS sertificates
ADD package.json yarn.lock /usr/src/app/
RUN yarn install --production
ADD . /usr/src/app/

CMD ["node", "index.js"]
