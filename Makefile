.PHONY: dev test test-coverage test-e2e test-e2e-headed test-e2e-debug test-all package make-dist setup

setup:
	npm install

dev:
	npm start

test:
	npm test

test-coverage:
	npm run test:coverage

test-e2e:
	npm run test:e2e

test-e2e-headed:
	npm run test:e2e:headed

test-e2e-debug:
	npm run test:e2e:debug

test-all:
	npm run test:all

package:
	npm run package

make-dist:
	npm run make
