import os
import yaml
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

class Config:
    def __init__(self, config_path: str = None):
        if config_path is None:
            # Look for config.yaml in the same directory as this file
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

        # JIRA Custom Field IDs
        self.field_ids = self.data["jira"].get("field_ids", {
            "tpd_bu": "customfield_12345", 
            "eng_hours": "customfield_12346",
            "work_stream": "customfield_12347"
        })

        # Flatten mappings for O(1) lookup
        self.tpd_lookup = {}
        for bu, keys in self.data.get("tpd_business_unit_mapping", {}).items():
            for key in keys:
                self.tpd_lookup[key] = bu

        self.work_stream_lookup = {}
        for ws, keys in self.data.get("work_stream_mapping", {}).items():
            for key in keys:
                self.work_stream_lookup[key] = ws

    def get_tpd_bu(self, parent_key: str):
        return self.tpd_lookup.get(parent_key)

    def get_work_stream(self, parent_key: str):
        return self.work_stream_lookup.get(parent_key)

    def update_config(self, project_key: str = None, tpd_mapping: dict = None, work_stream_mapping: dict = None, field_ids: dict = None, eng_start: str = None, eng_end: str = None):
        if project_key:
            self.project_key = project_key
            self.data["jira"]["project_key"] = project_key

        if eng_start:
            self.eng_start_status = eng_start
            self.data["engineering_hours_start_status"] = eng_start

        if eng_end:
            self.eng_end_status = eng_end
            self.data["engineering_hours_end_status"] = eng_end

        if field_ids:
            self.field_ids = field_ids
            self.data["jira"]["field_ids"] = field_ids

        if tpd_mapping is not None:
            self.data["tpd_business_unit_mapping"] = tpd_mapping
            # Update lookups
            self.tpd_lookup = {}
            for bu, keys in tpd_mapping.items():
                for key in keys:
                    self.tpd_lookup[key] = bu

        if work_stream_mapping is not None:
            self.data["work_stream_mapping"] = work_stream_mapping
            # Update lookups
            self.work_stream_lookup = {}
            for ws, keys in work_stream_mapping.items():
                for key in keys:
                    self.work_stream_lookup[key] = ws

        # Save to file
        with open(self.config_path, "w") as f:
            yaml.safe_dump(self.data, f)

config = Config()
