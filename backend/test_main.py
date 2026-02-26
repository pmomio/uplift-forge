"""Tests for main.py — app initialization, CORS, routers."""

import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


class TestAppInit:

    def test_app_title(self):
        assert app.title == "Uplift Forge"

    def test_cors_headers(self):
        resp = client.options("/config", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        })
        # With allow_credentials=True, CORS reflects the origin instead of *
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_tickets_router_registered(self):
        routes = [r.path for r in app.routes]
        assert "/tickets" in routes
        assert "/metrics/team" in routes
        assert "/metrics/individual" in routes

    def test_config_router_registered(self):
        routes = [r.path for r in app.routes]
        assert "/config" in routes
        assert "/sync" in routes
        assert "/jira/project" in routes
        assert "/jira/members" in routes
        assert "/jira/statuses" in routes
        assert "/jira/fields" in routes
