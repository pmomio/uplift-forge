.PHONY: help setup dev lint test test-watch test-coverage test-e2e test-e2e-headed test-e2e-debug test-all package make-dist publish clean rebuild

# 🎯 Default target — show help
.DEFAULT_GOAL := help

help: ## 📖 Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## 📦 Install all dependencies
	npm install

dev: ## 🔥 Launch in dev mode (Vite HMR + Electron)
	npm start

lint: ## 🔍 Run ESLint
	npm run lint

test: ## 🧪 Run all unit tests (vitest)
	npm test

test-watch: ## 👀 Run tests in watch mode
	npm run test:watch

test-coverage: ## 📊 Run tests with coverage report
	npm run test:coverage

test-e2e: ## 🎭 Run e2e tests (Playwright + Electron)
	npm run test:e2e

test-e2e-headed: ## 👀 Run e2e tests with visible window
	npm run test:e2e:headed

test-e2e-debug: ## 🐛 Run e2e tests in debug mode (Playwright Inspector)
	npm run test:e2e:debug

test-all: ## 🧪🎭 Run unit + e2e tests
	npm run test:all

package: ## 📦 Package the app
	npm run package

make-dist: ## 🏗️ Build distributables (DMG, Squirrel, ZIP)
	npm run make

publish: ## 🚀 Publish to GitHub Releases
	npm run publish

clean: ## 🧹 Remove build artifacts (out/, .vite/)
	rm -rf out/ .vite/

rebuild: clean setup ## 🔄 Clean and reinstall from scratch
