from apscheduler.schedulers.background import BackgroundScheduler
from routes.tickets import sync_tickets
from config import config

scheduler = BackgroundScheduler()

# Schedule the sync task
scheduler.add_job(
    sync_tickets,
    'interval',
    minutes=config.sync_config['interval_minutes'],
    id='sync_tickets_job'
)
