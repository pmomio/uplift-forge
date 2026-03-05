.PHONY: dev test test-coverage package make-dist setup

setup:
	npm install

dev:
	npm start

test:
	npm test

test-coverage:
	npm run test:coverage

package:
	npm run package

make-dist:
	npm run make
