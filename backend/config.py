import os
import yaml
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

class Config:
    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = Path(__file__).parent / "config.yaml"
        self.config_path = Path(config_path)
        with open(self.config_path, "r") as f:
            self.data = yaml.safe_load(f)

        # Override secrets with environment variables
        self.jira_api_token = os.getenv("JIRA_API_TOKEN")
        self.jira_email = os.getenv("JIRA_EMAIL", self.data["jira"]["email"])
        self.jira_base_url = os.getenv("JIRA_BASE_URL", self.data["jira"]["base_url"])

        self.project_key = self.data["jira"]["project_key"]
        self.office_hours = self.data["office_hours"]
        self.sync_config = self.data["sync"]

        # Engineering hours statuses
        self.eng_start_status = self.data.get("engineering_hours_start_status", "In Progress")
        self.eng_end_status = self.data.get("engineering_hours_end_status", "In Review")
        self.eng_excluded_statuses = self.data.get("engineering_hours_excluded_statuses", ["Blocked"])

        # Ticket filter
        self.ticket_filter = self.data.get("ticket_filter", {"mode": "all", "months": 3})

        # JIRA Custom Field IDs
        self.field_ids = self.data["jira"].get("field_ids", {
            "tpd_bu": "customfield_12345",
            "eng_hours": "customfield_12346",
            "work_stream": "customfield_12347"
        })

        # Mapping rules (with migration from old parent-key format)
        self._init_mapping_rules()

    def _init_mapping_rules(self):
        if "mapping_rules" in self.data:
            self.mapping_rules = self.data["mapping_rules"]
            return

        # Migrate old parent-key mappings to new Rule[][] format
        # Each rule becomes its own AND-block (single-rule block), OR'd together
        tpd_rules = {}
        for bu, keys in self.data.get("tpd_business_unit_mapping", {}).items():
            tpd_rules[bu] = [
                [{"field": "parent_key", "operator": "equals", "value": k}]
                for k in keys
            ]
        ws_rules = {}
        for ws, keys in self.data.get("work_stream_mapping", {}).items():
            ws_rules[ws] = [
                [{"field": "parent_key", "operator": "equals", "value": k}]
                for k in keys
            ]
        self.mapping_rules = {"tpd_bu": tpd_rules, "work_stream": ws_rules}

    def update_config(self, project_key=None, field_ids=None, eng_start=None,
                      eng_end=None, eng_excluded_statuses=None, ticket_filter=None,
                      mapping_rules=None, **_ignored):
        if project_key:
            self.project_key = project_key
            self.data["jira"]["project_key"] = project_key

        if eng_start:
            self.eng_start_status = eng_start
            self.data["engineering_hours_start_status"] = eng_start

        if eng_end:
            self.eng_end_status = eng_end
            self.data["engineering_hours_end_status"] = eng_end

        if eng_excluded_statuses is not None:
            self.eng_excluded_statuses = eng_excluded_statuses
            self.data["engineering_hours_excluded_statuses"] = eng_excluded_statuses

        if ticket_filter is not None:
            self.ticket_filter = ticket_filter
            self.data["ticket_filter"] = ticket_filter

        if field_ids:
            self.field_ids = field_ids
            self.data["jira"]["field_ids"] = field_ids

        if mapping_rules is not None:
            self.mapping_rules = mapping_rules
            self.data["mapping_rules"] = mapping_rules
            # Remove old format keys if present
            self.data.pop("tpd_business_unit_mapping", None)
            self.data.pop("work_stream_mapping", None)

        # Save to file
        with open(self.config_path, "w") as f:
            yaml.safe_dump(self.data, f)

config = Config()
