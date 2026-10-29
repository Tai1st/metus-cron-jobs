git pull
yarn install --frozen-lockfile
yarn build
pm2 startOrReload ecosystem.config.js
