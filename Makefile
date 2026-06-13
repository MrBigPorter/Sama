# ============================================================================
# Sama — Makefile for dev / preview (staging) / production workflows
# ============================================================================
# Inspired by frontend-blog-mobile/Makefile, but tailored for Expo SDK 56
# with EAS Build + EAS Update instead of bare RN + CodePush.
# ============================================================================

.DEFAULT_GOAL := help
SHELL := /bin/zsh

.PHONY: help start dev dev-ios dev-android \
        preview preview-ios preview-android \
        production production-ios production-android \
        update-dev update-staging update-prod \
        lint typecheck test check \
        clean install

# ── Help ──────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────────────────

install: ## Install dependencies (Expo recommended way)
	npx expo install

start: ## Start Expo dev server (port 8082, avoids conflict with Metro on 8081)
	npx expo start --port 8082

dev: start ## Alias for start

dev-ios: ## Build & run development build on iOS Simulator
	eas build --profile development --platform ios --local

dev-android: ## Build & run development build on Android emulator
	eas build --profile development --platform android --local

# ── Preview (Staging) ────────────────────────────────────────────────────

preview-ios: ## Build iOS staging binary for TestFlight
	eas build --profile preview --platform ios

preview-android: ## Build Android staging APK for Play Console Internal Testing
	eas build --profile preview --platform android

preview: preview-ios preview-android ## Build both platforms for staging

# ── Production ───────────────────────────────────────────────────────────

production-ios: ## Build iOS production binary for App Store submission
	eas build --profile production --platform ios

production-android: ## Build Android production AAB for Play Store
	eas build --profile production --platform android

production: production-ios production-android ## Build both platforms for production

# ── OTA Updates (EAS Update) ────────────────────────────────────────────

update-dev: ## Push OTA update to development branch
	eas update --branch development --message "$(message)"

update-staging: ## Push OTA update to staging branch
	eas update --branch staging --message "$(message)"

update-prod: ## Push OTA update to production branch
	eas update --branch production --message "$(message)"

# ── Code Quality ─────────────────────────────────────────────────────────

lint: ## Run ESLint
	npx eslint src/

typecheck: ## Run TypeScript type check
	npx tsc --noEmit

check: lint typecheck ## Run all checks (alias for CI)

# ── Utilities ─────────────────────────────────────────────────────────────

clean: ## Clean node_modules and reinstall
	rm -rf node_modules
	npx expo install

update: ## Show outdated/expo-compatible dependency versions
	npx expo install --check
